import { fmt, toDisplay } from "@/lib/units";

export type EditorItem = {
  key: string;
  exercise_id: string;
  name_ar: string;
  name_en: string;
  // kept as text while editing; converted when saving
  sets: string;
  repsMin: string;
  repsMax: string;
  weight: string; // in the user's unit
  rest: string;
};

/** database row -> editable text fields */
export function toEditorItem(
  row: {
    id: string;
    exercise_id: string;
    target_sets: number;
    target_reps_min: number | null;
    target_reps_max: number | null;
    target_weight_kg: number | null;
    rest_seconds: number;
    exercises: { name_ar: string; name_en: string };
  },
  unit: "kg" | "lb",
): EditorItem {
  return {
    key: row.id,
    exercise_id: row.exercise_id,
    name_ar: row.exercises.name_ar,
    name_en: row.exercises.name_en,
    sets: String(row.target_sets),
    repsMin: row.target_reps_min == null ? "" : String(row.target_reps_min),
    repsMax: row.target_reps_max == null ? "" : String(row.target_reps_max),
    weight: row.target_weight_kg == null ? "" : fmt(toDisplay(row.target_weight_kg, unit)),
    rest: String(row.rest_seconds),
  };
}
