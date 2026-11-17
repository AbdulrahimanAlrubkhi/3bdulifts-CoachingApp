import { fmt, toDisplay, type Unit } from "@/lib/units";

export type SetRow = {
  id: string;
  position: number;
  set_type: string;
  weight_kg: number | null;
  reps: number | null;
  rpe: number | null;
  completed_at: string | null;
};

/** A set as edited on screen: inputs stay text until saved. Weight is in the user's unit. */
export type LiveSet = {
  id: string;
  position: number;
  weight: string;
  reps: string;
  rpe: string;
  completedAt: string | null;
};

export function toLiveSet(row: SetRow, unit: Unit): LiveSet {
  return {
    id: row.id,
    position: row.position,
    weight: row.weight_kg == null ? "" : fmt(toDisplay(row.weight_kg, unit)).replace(",", ""),
    reps: row.reps == null ? "" : String(row.reps),
    rpe: row.rpe == null ? "" : String(Number(row.rpe)),
    completedAt: row.completed_at,
  };
}
