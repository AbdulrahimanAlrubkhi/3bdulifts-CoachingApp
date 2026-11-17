"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Exercise } from "@/lib/exercise-meta";
import { usePrefs } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { fmt, parseNum, toDisplay, toKg } from "@/lib/units";
import { fetchPrevious, type PreviousSet } from "@/lib/workout-stats";
import { ExercisePicker } from "@/components/ExerciseList";
import { Card, buttonClass, ghostButtonClass } from "@/components/ui";
import { toLiveSet, type LiveSet, type SetRow } from "./live-set";

export type Target = {
  target_reps_min: number | null;
  target_reps_max: number | null;
  target_weight_kg: number | null;
};

export type LiveExercise = {
  id: string;
  exercise_id: string;
  rest_seconds: number;
  name_ar: string;
  name_en: string;
  sets: LiveSet[];
};

type Props = {
  workout: { id: string; title: string; started_at: string };
  initialExercises: LiveExercise[];
  initialPrevious: Record<string, PreviousSet[]>;
  targets: Record<string, Target>;
  library: Exercise[];
};

const cell =
  "h-10 w-full rounded-md border border-line bg-bg px-1 text-center text-[15px] outline-none focus:border-accent placeholder:text-muted/70";
const columns = "grid grid-cols-[1.5rem_minmax(0,1fr)_3.75rem_3rem_2.75rem_2.5rem] items-center gap-1.5";

function clock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function LiveWorkout({ workout, initialExercises, initialPrevious, targets, library }: Props) {
  const { t, name, unit, userId } = usePrefs();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [exercises, setExercises] = useState(initialExercises);
  const [previous, setPrevious] = useState(initialPrevious);
  const [picking, setPicking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  // One ticking clock drives both the workout duration and the rest countdown.
  const [now, setNow] = useState<number | null>(null);
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, []);

  const restLeft = rest && now != null ? (rest.endsAt - now) / 1000 : 0;
  useEffect(() => {
    if (rest && restLeft <= 0) {
      navigator.vibrate?.(300);
      setRest(null);
    }
  }, [rest, restLeft]);

  const check = (result: { error: unknown }) => {
    setFailed(Boolean(result.error));
    return !result.error;
  };

  const editSet = (exerciseId: string, setId: string, change: Partial<LiveSet>) =>
    setExercises((list) =>
      list.map((e) =>
        e.id !== exerciseId ? e : { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...change } : s)) },
      ),
    );

  const saveSet = async (set: LiveSet) => {
    const weight = parseNum(set.weight);
    const rpe = parseNum(set.rpe);
    check(
      await supabase
        .from("workout_sets")
        .update({
          weight_kg: weight == null ? null : toKg(weight, unit),
          reps: parseNum(set.reps) == null ? null : Math.round(parseNum(set.reps)!),
          rpe: rpe == null ? null : Math.min(10, Math.max(1, rpe)),
          completed_at: set.completedAt,
        })
        .eq("id", set.id),
    );
  };

  /** What to suggest for set number `index`: last session's numbers first, then the routine target. */
  const hint = (exercise: LiveExercise, index: number) => {
    const last = previous[exercise.exercise_id]?.[index];
    const target = targets[exercise.exercise_id];
    const weightKg = last?.weight_kg ?? target?.target_weight_kg ?? null;
    return {
      last,
      weight: weightKg == null ? "" : fmt(toDisplay(weightKg, unit)).replace(",", ""),
      reps: String(last?.reps ?? target?.target_reps_min ?? target?.target_reps_max ?? ""),
    };
  };

  const toggleDone = (exercise: LiveExercise, set: LiveSet, index: number) => {
    if (set.completedAt) {
      const next = { ...set, completedAt: null };
      editSet(exercise.id, set.id, next);
      void saveSet(next);
      return;
    }
    // ticking an empty set accepts the suggested numbers
    const suggestion = hint(exercise, index);
    const next = {
      ...set,
      weight: set.weight || suggestion.weight,
      reps: set.reps || suggestion.reps,
      completedAt: new Date().toISOString(),
    };
    if (parseNum(next.reps) == null) return; // nothing to log yet
    editSet(exercise.id, set.id, next);
    void saveSet(next);
    if (exercise.rest_seconds > 0) {
      setRest({ endsAt: Date.now() + exercise.rest_seconds * 1000, total: exercise.rest_seconds });
    }
  };

  const addSet = async (exercise: LiveExercise) => {
    const last = exercise.sets.at(-1);
    const weight = last ? parseNum(last.weight) : null;
    const result = await supabase
      .from("workout_sets")
      .insert({
        workout_exercise_id: exercise.id,
        user_id: userId,
        position: (last?.position ?? -1) + 1,
        weight_kg: weight == null ? null : toKg(weight, unit),
      })
      .select("id, position, set_type, weight_kg, reps, rpe, completed_at")
      .single();
    if (!check(result) || !result.data) return;
    const added = toLiveSet(result.data as SetRow, unit);
    setExercises((list) => list.map((e) => (e.id === exercise.id ? { ...e, sets: [...e.sets, added] } : e)));
  };

  const removeSet = async (exercise: LiveExercise, set: LiveSet) => {
    // an empty set goes straight away; one with numbers in it asks first
    if ((set.completedAt || set.weight || set.reps) && !window.confirm(t("w.confirmDelete"))) return;
    if (!check(await supabase.from("workout_sets").delete().eq("id", set.id))) return;
    setExercises((list) =>
      list.map((e) => (e.id === exercise.id ? { ...e, sets: e.sets.filter((s) => s.id !== set.id) } : e)),
    );
  };

  const addExercise = async (picked: Exercise) => {
    setPicking(false);
    const result = await supabase
      .from("workout_exercises")
      .insert({ workout_id: workout.id, user_id: userId, exercise_id: picked.id, position: exercises.length })
      .select("id, rest_seconds")
      .single();
    if (!check(result) || !result.data) return;
    const added: LiveExercise = {
      id: result.data.id,
      exercise_id: picked.id,
      rest_seconds: result.data.rest_seconds,
      name_ar: picked.name_ar,
      name_en: picked.name_en,
      sets: [],
    };
    setExercises((list) => [...list, added]);
    setPrevious({ ...previous, ...(await fetchPrevious(supabase, userId, [picked.id], workout.id)) });
    await addSet(added);
  };

  const removeExercise = async (exercise: LiveExercise) => {
    if (!window.confirm(t("w.confirmDelete"))) return;
    if (!check(await supabase.from("workout_exercises").delete().eq("id", exercise.id))) return;
    setExercises((list) => list.filter((e) => e.id !== exercise.id));
  };

  const finish = async () => {
    setBusy(true);
    // nothing logged at all: there is nothing to keep, so it is removed rather than saved empty
    if (!exercises.some((e) => e.sets.some((s) => s.completedAt))) {
      const ok = check(await supabase.from("workouts").delete().eq("id", workout.id));
      if (ok) router.push("/workouts");
      else setBusy(false);
      return;
    }
    // sets that were never ticked are dropped; only logged work is kept
    const unfinished = exercises.flatMap((e) => e.sets.filter((s) => !s.completedAt).map((s) => s.id));
    if (unfinished.length) await supabase.from("workout_sets").delete().in("id", unfinished);
    // ...and so are exercises left without a single logged set
    const empty = exercises.filter((e) => !e.sets.some((s) => s.completedAt)).map((e) => e.id);
    if (empty.length) await supabase.from("workout_exercises").delete().in("id", empty);
    const ok = check(await supabase.from("workouts").update({ ended_at: new Date().toISOString() }).eq("id", workout.id));
    if (ok) router.push(`/workouts/history/${workout.id}`);
    else setBusy(false);
  };

  const discard = async () => {
    if (!window.confirm(t("w.confirmDiscard"))) return;
    setBusy(true);
    const ok = check(await supabase.from("workouts").delete().eq("id", workout.id));
    if (ok) router.push("/workouts");
    else setBusy(false);
  };

  const elapsed = now == null ? null : (now - new Date(workout.started_at).getTime()) / 1000;

  return (
    <div className={rest ? "pb-20" : ""}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h1 className="truncate text-xl font-semibold tracking-tight">{workout.title}</h1>
        <span className="num text-sm text-muted" aria-label={t("w.duration")}>
          {elapsed == null ? "–" : clock(elapsed)}
        </span>
      </div>

      {failed && <p className="mb-3 text-sm text-danger" role="alert">{t("w.saveFailed")}</p>}

      <div className="space-y-3">
        {exercises.map((exercise) => (
          <Card key={exercise.id} className="p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-[15px] font-medium">{name(exercise)}</h2>
              <button type="button" onClick={() => removeExercise(exercise)} aria-label={t("w.remove")} className="h-8 w-8 shrink-0 rounded-md border border-line text-danger">
                ×
              </button>
            </div>

            <div className={`${columns} mb-1 text-center text-[11px] text-muted`}>
              <span>#</span>
              <span>{t("w.previous")}</span>
              <span>{unit}</span>
              <span>{t("w.reps")}</span>
              <span>{t("w.rpe")}</span>
              <span />
            </div>

            <ul className="space-y-1.5">
              {exercise.sets.map((set, index) => {
                const suggestion = hint(exercise, index);
                const done = Boolean(set.completedAt);
                const field = (key: "weight" | "reps" | "rpe", label: string, placeholder: string) => (
                  <input
                    inputMode="decimal"
                    aria-label={label}
                    value={set[key]}
                    placeholder={placeholder}
                    onChange={(e) => editSet(exercise.id, set.id, { [key]: e.target.value })}
                    onBlur={() => void saveSet(set)}
                    className={`${cell} num ${done ? "border-transparent bg-transparent" : ""}`}
                  />
                );
                return (
                  <li key={set.id} className={`${columns} ${done ? "text-accent" : ""}`}>
                    <button type="button" onClick={() => removeSet(exercise, set)} aria-label={`${t("w.remove")} ${index + 1}`} className="num text-sm text-muted">
                      {index + 1}
                    </button>
                    <span className="num truncate text-center text-xs text-muted">
                      {suggestion.last
                        ? `${fmt(toDisplay(suggestion.last.weight_kg, unit))} × ${suggestion.last.reps ?? "–"}`
                        : "–"}
                    </span>
                    {field("weight", t("w.weight"), suggestion.weight)}
                    {field("reps", t("w.reps"), suggestion.reps)}
                    {field("rpe", t("w.rpe"), "")}
                    <button
                      type="button"
                      onClick={() => toggleDone(exercise, set, index)}
                      aria-pressed={done}
                      aria-label={t("w.done")}
                      className={`h-10 rounded-md border text-base ${done ? "border-accent bg-accent text-accent-ink" : "border-line text-muted"}`}
                    >
                      ✓
                    </button>
                  </li>
                );
              })}
            </ul>

            <button type="button" onClick={() => addSet(exercise)} className={`${ghostButtonClass} mt-3 w-full`}>
              + {t("w.addSet")}
            </button>
          </Card>
        ))}
      </div>

      <button type="button" onClick={() => setPicking(true)} className={`${ghostButtonClass} mt-3 h-11 w-full`}>
        + {t("w.addExercise")}
      </button>

      <div className="mt-6 space-y-3">
        <button type="button" onClick={finish} disabled={busy} className={buttonClass}>
          {t("w.finish")}
        </button>
        <button type="button" onClick={discard} disabled={busy} className={`${ghostButtonClass} w-full text-danger`}>
          {t("w.discard")}
        </button>
      </div>

      {rest && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface" role="timer">
          <div className="h-0.5 bg-accent transition-[width] duration-500 ease-linear" style={{ width: `${Math.max(0, (restLeft / rest.total) * 100)}%` }} />
          <div className="mx-auto flex h-14 max-w-xl items-center justify-between gap-2 px-4">
            <span className="text-sm text-muted">{t("w.restTimer")}</span>
            <span className="num text-xl font-semibold">{clock(Math.ceil(restLeft))}</span>
            <span className="flex gap-1.5">
              {([-15, 15] as const).map((delta) => (
                <button
                  key={delta}
                  type="button"
                  className={`${ghostButtonClass} num`}
                  onClick={() => setRest({ endsAt: rest.endsAt + delta * 1000, total: Math.max(rest.total, restLeft + delta) })}
                >
                  {delta > 0 ? "+15" : "−15"}
                </button>
              ))}
              <button type="button" className={ghostButtonClass} onClick={() => setRest(null)}>
                {t("w.skip")}
              </button>
            </span>
          </div>
        </div>
      )}

      {picking && <ExercisePicker exercises={library} onPick={addExercise} onClose={() => setPicking(false)} />}
    </div>
  );
}
