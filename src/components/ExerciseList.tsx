"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EQUIPMENT, MUSCLES, type Exercise } from "@/lib/exercise-meta";
import { usePrefs } from "@/lib/i18n/client";
import type { TKey } from "@/lib/i18n/dictionaries";
import { inputClass } from "./ui";

export const selectClass =
  "h-10 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 text-sm text-text outline-none focus:border-accent";

/** Searchable, filterable exercise list. With onPick it selects; without, each row links to the exercise page. */
export function ExerciseList({ exercises, onPick }: { exercises: Exercise[]; onPick?: (exercise: Exercise) => void }) {
  const { t, name } = usePrefs();
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState("");
  const [equipment, setEquipment] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter(
      (e) =>
        (!muscle || e.muscle === muscle) &&
        (!equipment || e.equipment === equipment) &&
        // matches either language, whichever one is on screen
        (!q || e.name_ar.includes(q) || e.name_en.toLowerCase().includes(q)),
    );
  }, [exercises, query, muscle, equipment]);

  const rowClass =
    "flex w-full items-center justify-between gap-3 border-b border-line py-3 text-start last:border-b-0";

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("w.search")}
        className={inputClass}
      />
      <div className="mt-2 flex gap-2">
        <select value={muscle} onChange={(e) => setMuscle(e.target.value)} className={selectClass} aria-label={t("w.muscle")}>
          <option value="">{t("w.allMuscles")}</option>
          {MUSCLES.map((m) => (
            <option key={m} value={m}>
              {t(`muscle.${m}` as TKey)}
            </option>
          ))}
        </select>
        <select value={equipment} onChange={(e) => setEquipment(e.target.value)} className={selectClass} aria-label={t("w.equipment")}>
          <option value="">{t("w.allEquipment")}</option>
          {EQUIPMENT.map((q) => (
            <option key={q} value={q}>
              {t(`equip.${q}` as TKey)}
            </option>
          ))}
        </select>
      </div>

      <ul className="mt-2">
        {shown.map((exercise) => {
          const body = (
            <>
              <span className="text-[15px]">{name(exercise)}</span>
              <span className="shrink-0 text-xs text-muted">
                {t(`muscle.${exercise.muscle}` as TKey)} · {t(`equip.${exercise.equipment}` as TKey)}
              </span>
            </>
          );
          return (
            <li key={exercise.id}>
              {onPick ? (
                <button type="button" className={rowClass} onClick={() => onPick(exercise)}>
                  {body}
                </button>
              ) : (
                <Link href={`/workouts/exercises/${exercise.id}`} className={rowClass}>
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      {!shown.length && <p className="py-6 text-center text-sm text-muted">{t("w.noMatch")}</p>}
    </div>
  );
}

/** Full-screen sheet for choosing an exercise (routine editor and live workout). */
export function ExercisePicker({
  exercises,
  onPick,
  onClose,
}: {
  exercises: Exercise[];
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
}) {
  const { t } = usePrefs();
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-bg" role="dialog" aria-modal="true" aria-label={t("w.addExercise")}>
      <div className="mx-auto max-w-xl px-4 pb-10">
        <div className="sticky top-0 z-10 flex h-14 items-center justify-between bg-bg">
          <h2 className="text-base font-semibold">{t("w.addExercise")}</h2>
          <button type="button" onClick={onClose} className="h-9 rounded-md border border-line px-3 text-sm text-muted hover:text-text">
            {t("w.close")}
          </button>
        </div>
        <ExerciseList exercises={exercises} onPick={onPick} />
      </div>
    </div>
  );
}
