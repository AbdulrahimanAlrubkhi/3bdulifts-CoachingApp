import type { Macros, Target } from "./nutrition";

export const SCALES = ["energy", "hunger", "stress"] as const;
export type Scale = (typeof SCALES)[number];

export const MEASUREMENTS = ["waist_cm", "chest_cm", "hip_cm", "arm_cm"] as const;
export type Measurement = (typeof MEASUREMENTS)[number];

export const POSES = ["front", "side", "back"] as const;
export type Pose = (typeof POSES)[number];

export const PHOTO_BUCKET = "progress-photos";
/** How long a link to a private photo works. Long enough to look at a page, short enough that a copied link soon expires. */
export const PHOTO_LINK_SECONDS = 600;

/** Storage path for a progress photo. The first folder must be the user's id (storage policy). */
export function photoPath(userId: string, weekStart: string, pose: Pose) {
  return `${userId}/${weekStart}/${pose}.jpg`;
}

/** Weekly reflection questions. Answers are stored under these keys; the wording lives in the dictionary. */
export const REFLECTIONS = [
  { key: "rating", kind: "score" }, // the week out of 10
  { key: "wins", kind: "text" },
  { key: "hardest", kind: "text" },
  { key: "next_focus", kind: "text" },
  { key: "question", kind: "text" },
] as const;
export type ReflectionKey = (typeof REFLECTIONS)[number]["key"];

export type DailyCheckin = {
  check_date: string;
  weight_kg: number | null;
  steps: number | null;
  sleep_hours: number | null;
  energy: number | null;
  hunger: number | null;
  stress: number | null;
  notes: string | null;
};

export const DAILY_COLUMNS = "check_date, weight_kg, steps, sleep_hours, energy, hunger, stress, notes";

export function normalizeDaily(row: DailyCheckin): DailyCheckin {
  return {
    ...row,
    weight_kg: row.weight_kg == null ? null : Number(row.weight_kg),
    sleep_hours: row.sleep_hours == null ? null : Number(row.sleep_hours),
  };
}

/**
 * How a day's food log compares with the target. A day is "on target" when calories land
 * within 10% of target and protein reaches at least 90% of it. The coach dashboard (step 4)
 * uses the same rule for nutrition adherence.
 */
export function nutritionStatus(totals: Macros, target: Target | null, logged: boolean) {
  if (!target || !logged) return { status: "none" as const, calPct: null, proteinPct: null };
  // compare the exact ratios; rounding first would let 110.05% count as "within 10%"
  const cal = totals.calories / target.calories;
  const protein = totals.protein_g / target.protein_g;
  const status = cal > 1.1 ? ("over" as const) : cal >= 0.9 && protein >= 0.9 ? ("on" as const) : ("under" as const);
  const calPct = Math.round(cal * 100);
  const proteinPct = Math.round(protein * 100);
  return { status, calPct, proteinPct };
}
