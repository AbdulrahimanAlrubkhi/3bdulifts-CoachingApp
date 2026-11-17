"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import type { Exercise } from "@/lib/exercise-meta";
import { usePrefs } from "@/lib/i18n/client";
import { parseNum, toKg } from "@/lib/units";
import { ExercisePicker } from "@/components/ExerciseList";
import { Card, buttonClass, ghostButtonClass, inputClass } from "@/components/ui";
import type { EditorItem } from "./editor-item";
import { deleteRoutine, saveRoutine, setRoutineAssignment, setRoutineShare } from "../../actions";

type Props = {
  routine: { id: string; title: string; notes: string; share_token: string | null };
  initialItems: EditorItem[];
  exercises: Exercise[];
  clients: { id: string; full_name: string; assigned: boolean }[] | null; // coach only
};

const cell = "h-10 w-full rounded-md border border-line bg-bg px-1 text-center text-sm outline-none focus:border-accent";

export function RoutineEditor({ routine, initialItems, exercises, clients }: Props) {
  const { t, name, unit } = usePrefs();
  const [title, setTitle] = useState(routine.title);
  const [notes, setNotes] = useState(routine.notes);
  const [items, setItems] = useState(initialItems);
  const [picking, setPicking] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");
  const [token, setToken] = useState(routine.share_token);
  const [copied, setCopied] = useState(false);
  const [assigned, setAssigned] = useState(() => new Set(clients?.filter((c) => c.assigned).map((c) => c.id)));
  const [pending, startTransition] = useTransition();

  const patch = (key: string, change: Partial<EditorItem>) => {
    setStatus("idle");
    setItems((list) => list.map((item) => (item.key === key ? { ...item, ...change } : item)));
  };

  const move = (index: number, by: -1 | 1) => {
    setStatus("idle");
    setItems((list) => {
      const next = [...list];
      const target = index + by;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const save = () =>
    startTransition(async () => {
      const result = await saveRoutine(routine.id, {
        title,
        notes,
        items: items.map((item) => {
          const weight = parseNum(item.weight);
          return {
            exercise_id: item.exercise_id,
            target_sets: parseNum(item.sets) ?? 3,
            target_reps_min: parseNum(item.repsMin),
            target_reps_max: parseNum(item.repsMax),
            target_weight_kg: weight == null ? null : toKg(weight, unit),
            rest_seconds: parseNum(item.rest) ?? 120,
          };
        }),
      });
      setStatus(result.ok ? "saved" : "failed");
    });

  // the site address is only known in the browser
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const shareUrl = token ? `${origin}/r/${token}` : "";

  return (
    <div className="space-y-4">
      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setStatus("idle");
        }}
        placeholder={t("w.title")}
        aria-label={t("w.title")}
        className={`${inputClass} text-base font-medium`}
      />
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setStatus("idle");
        }}
        placeholder={t("w.notes")}
        aria-label={t("w.notes")}
        rows={2}
        className={`${inputClass} h-auto py-2`}
      />

      <ol className="space-y-2">
        {items.map((item, index) => (
          <li key={item.key}>
            <Card className="p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[15px] font-medium">{name(item)}</span>
                <span className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={t("w.up")} className="h-8 w-8 rounded-md border border-line text-muted disabled:opacity-30">
                    ↑
                  </button>
                  <button type="button" onClick={() => move(index, 1)} disabled={index === items.length - 1} aria-label={t("w.down")} className="h-8 w-8 rounded-md border border-line text-muted disabled:opacity-30">
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStatus("idle");
                      setItems((list) => list.filter((i) => i.key !== item.key));
                    }}
                    aria-label={t("w.remove")}
                    className="h-8 w-8 rounded-md border border-line text-danger"
                  >
                    ×
                  </button>
                </span>
              </div>
              <div className="mt-3 grid grid-cols-5 gap-2">
                {(
                  [
                    ["sets", t("w.sets")],
                    ["repsMin", t("w.repsMin")],
                    ["repsMax", t("w.repsMax")],
                    ["weight", `${t("w.weight")} (${unit})`],
                    ["rest", t("w.rest")],
                  ] as const
                ).map(([field, label]) => (
                  <label key={field} className="block">
                    <span className="mb-1 block truncate text-center text-[11px] text-muted">{label}</span>
                    <input
                      inputMode="decimal"
                      value={item[field]}
                      onChange={(e) => patch(item.key, { [field]: e.target.value })}
                      className={cell}
                    />
                  </label>
                ))}
              </div>
            </Card>
          </li>
        ))}
      </ol>

      <button type="button" onClick={() => setPicking(true)} className={`${ghostButtonClass} h-11 w-full`}>
        + {t("w.addExercise")}
      </button>

      <div>
        <button type="button" onClick={save} disabled={pending} className={buttonClass}>
          {t("w.save")}
        </button>
        <p className="mt-2 h-5 text-center text-sm" role="status">
          {status === "saved" && <span className="text-accent">{t("w.saved")}</span>}
          {status === "failed" && <span className="text-danger">{t("w.saveFailed")}</span>}
        </p>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">{t("w.share")}</h2>
          <button
            type="button"
            className={ghostButtonClass}
            disabled={pending}
            onClick={() => startTransition(async () => setToken(await setRoutineShare(routine.id, !token)))}
          >
            {token ? t("w.shareOff") : t("w.shareOn")}
          </button>
        </div>
        {token && (
          <div className="mt-3 flex gap-2">
            <input readOnly value={shareUrl} dir="ltr" className={`${inputClass} h-9 text-xs`} onFocus={(e) => e.target.select()} />
            <button
              type="button"
              className={ghostButtonClass}
              onClick={async () => {
                await navigator.clipboard.writeText(shareUrl);
                setCopied(true);
              }}
            >
              {copied ? t("w.copied") : t("w.copy")}
            </button>
          </div>
        )}
      </Card>

      {clients && (
        <Card>
          <h2 className="mb-1 text-sm font-medium">{t("w.assign")}</h2>
          {!clients.length && <p className="text-sm text-muted">{t("w.noClients")}</p>}
          <ul>
            {clients.map((client) => (
              <li key={client.id}>
                <label className="flex items-center justify-between border-b border-line py-3 last:border-b-0">
                  <span className="text-[15px]">{client.full_name || "—"}</span>
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-(--accent)"
                    checked={assigned.has(client.id)}
                    onChange={(e) => {
                      const on = e.target.checked;
                      startTransition(async () => {
                        const result = await setRoutineAssignment(routine.id, client.id, on);
                        if (!result.ok) return;
                        setAssigned((set) => {
                          const next = new Set(set);
                          if (on) next.add(client.id);
                          else next.delete(client.id);
                          return next;
                        });
                      });
                    }}
                  />
                </label>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <form
        action={deleteRoutine}
        onSubmit={(e) => {
          if (!window.confirm(t("w.confirmDelete"))) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={routine.id} />
        <button className={`${ghostButtonClass} text-danger`}>{t("w.delete")}</button>
      </form>

      {picking && (
        <ExercisePicker
          exercises={exercises}
          onClose={() => setPicking(false)}
          onPick={(exercise) => {
            setStatus("idle");
            setItems((list) => [
              ...list,
              {
                key: crypto.randomUUID(),
                exercise_id: exercise.id,
                name_ar: exercise.name_ar,
                name_en: exercise.name_en,
                sets: "3",
                repsMin: "8",
                repsMax: "12",
                weight: "",
                rest: "120",
              },
            ]);
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}
