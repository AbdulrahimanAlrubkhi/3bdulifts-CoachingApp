// Numbers and flags for the coach dashboard (spec #15). Pure functions: easy to test, no database.
import { nutritionStatus } from "./checkins";
import { addDays, daysBetween } from "./dates";
import type { Target } from "./nutrition";

/** Thresholds behind each flag. Change them here and the dashboard follows. */
export const FLAG_RULES = {
  /** flag when the last daily check-in is this many days ago or more */
  missedCheckinDays: 2,
  /** flag a cut/bulk client whose 7-day average weight moved less than this over two weeks */
  stalledKg: 0.3,
  /** at least this many weigh-ins in each week compared, so one missed day can't fake a stall */
  minWeighIns: 3,
  /** flag below these adherence percentages */
  lowWorkoutPct: 60,
  lowNutritionPct: 50,
  /** used when a client hasn't said how many days a week they train */
  defaultTrainingDays: 3,
};

export type Flag = "missed" | "stalled" | "lowWorkout" | "lowNutrition";

export type MetricsInput = {
  today: string;
  startDate: string; // when coaching started (or sign-up day)
  trainingDays: number | null;
  weighIns: { date: string; kg: number }[]; // daily check-ins with a weight, any order
  checkinDates: string[]; // every daily check-in date, with or without weight
  workoutDates: string[]; // Oman date of each finished workout
  nutritionDays: { date: string; calories: number; protein_g: number }[];
  targets: Target[]; // all of the client's targets, any order
};

export type ClientMetrics = {
  lastCheckin: string | null;
  daysSinceCheckin: number | null;
  avg7: number | null; // kg, last 7 days including today
  trendKgPerWeek: number | null; // this week's average minus last week's
  workoutPct: number | null;
  nutritionPct: number | null;
  phase: Target["phase"] | null;
  flags: Flag[];
};

function average(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/** Weigh-ins from `from` to `to`, both included. */
function windowKg(weighIns: MetricsInput["weighIns"], from: string, to: string) {
  return weighIns.filter((w) => w.date >= from && w.date <= to).map((w) => w.kg);
}

export function targetFor(targets: Target[], date: string): Target | null {
  return [...targets].sort((a, b) => b.effective_from.localeCompare(a.effective_from)).find((t) => t.effective_from <= date) ?? null;
}

export function clientMetrics(input: MetricsInput): ClientMetrics {
  const { today, startDate } = input;
  const daysCoached = Math.max(0, daysBetween(startDate, today)) + 1;

  // last check-in
  const lastCheckin = [...input.checkinDates].sort().at(-1) ?? null;
  const daysSinceCheckin = lastCheckin ? daysBetween(lastCheckin, today) : null;

  // weight: this week vs last week, and vs two weeks earlier for the stall check
  const thisWeek = windowKg(input.weighIns, addDays(today, -6), today);
  const lastWeek = windowKg(input.weighIns, addDays(today, -13), addDays(today, -7));
  const twoWeeksAgo = windowKg(input.weighIns, addDays(today, -20), addDays(today, -14));
  const avg7 = average(thisWeek);
  const avgLast = average(lastWeek);
  const trendKgPerWeek = avg7 != null && avgLast != null ? Math.round((avg7 - avgLast) * 100) / 100 : null;

  // workouts: finished in the last 14 days vs what the client planned (scaled down for new clients)
  const window = Math.min(14, daysCoached);
  const planned = ((input.trainingDays ?? FLAG_RULES.defaultTrainingDays) * window) / 7;
  const done = input.workoutDates.filter((d) => d > addDays(today, -14) && d <= today).length;
  const workoutPct = planned >= 1 ? Math.min(100, Math.round((done / planned) * 100)) : null;

  // nutrition: share of the last 7 full days (today is still in progress) that were on target
  const byDay = new Map(input.nutritionDays.map((d) => [d.date, d]));
  let eligible = 0;
  let onTarget = 0;
  for (let i = 1; i <= 7; i++) {
    const date = addDays(today, -i);
    if (date < startDate) continue;
    const target = targetFor(input.targets, date);
    if (!target) continue;
    eligible++;
    const day = byDay.get(date);
    const totals = { calories: day?.calories ?? 0, protein_g: day?.protein_g ?? 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };
    if (nutritionStatus(totals, target, Boolean(day)).status === "on") onTarget++;
  }
  const nutritionPct = eligible ? Math.round((onTarget / eligible) * 100) : null;

  const phase = targetFor(input.targets, today)?.phase ?? null;
  const flags: Flag[] = [];
  const missedSince = daysSinceCheckin ?? daysBetween(startDate, today);
  if (missedSince >= FLAG_RULES.missedCheckinDays) flags.push("missed");
  if (
    (phase === "cut" || phase === "bulk") &&
    thisWeek.length >= FLAG_RULES.minWeighIns &&
    twoWeeksAgo.length >= FLAG_RULES.minWeighIns &&
    Math.abs(average(thisWeek)! - average(twoWeeksAgo)!) < FLAG_RULES.stalledKg
  ) {
    flags.push("stalled");
  }
  if (workoutPct != null && workoutPct < FLAG_RULES.lowWorkoutPct) flags.push("lowWorkout");
  if (nutritionPct != null && nutritionPct < FLAG_RULES.lowNutritionPct) flags.push("lowNutrition");

  return {
    lastCheckin,
    daysSinceCheckin,
    avg7: avg7 == null ? null : Math.round(avg7 * 10) / 10,
    trendKgPerWeek,
    workoutPct,
    nutritionPct,
    phase,
    flags,
  };
}

/** Daily weights with a trailing 7-day average (calendar days, not entries) for the weight chart. */
export function weightSeries(weighIns: MetricsInput["weighIns"]) {
  const sorted = [...weighIns].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((w) => {
    const from = addDays(w.date, -6);
    const avg = average(sorted.filter((x) => x.date >= from && x.date <= w.date).map((x) => x.kg))!;
    return { date: w.date, kg: w.kg, avg: Math.round(avg * 100) / 100 };
  });
}
