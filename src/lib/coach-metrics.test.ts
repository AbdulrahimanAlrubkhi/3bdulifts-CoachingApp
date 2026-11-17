// Run with: npm test
import { clientMetrics, weightSeries } from "./coach-metrics";
import { addDays } from "./dates";

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra: unknown = "") => { if (cond) pass++; else fail++; console.log(cond ? "PASS" : "FAIL", name, cond ? "" : JSON.stringify(extra)); };

const today = "2026-11-17";
const cut = { id: "t", phase: "cut" as const, calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 60, fiber_g: null, water_ml: null, effective_from: "2026-10-01", note: null };
const days = (n: number, from = 0) => Array.from({ length: n }, (_, i) => addDays(today, -(i + from)));

// 1. steady loser, checked in today, trains as planned, eats on target
const good = clientMetrics({
  today, startDate: "2026-10-01", trainingDays: 3,
  weighIns: days(21).map((d, i) => ({ date: d, kg: 80 + i * 0.07 })), // ~0.5 kg/week down
  checkinDates: days(21), workoutDates: days(14).filter((_, i) => i % 2 === 0).slice(0, 6),
  nutritionDays: days(7, 1).map((d) => ({ date: d, calories: 2050, protein_g: 150 })), targets: [cut],
});
ok("good: no flags", good.flags.length === 0, good);
ok("good: trend about -0.5 kg/week", good.trendKgPerWeek! < -0.4 && good.trendKgPerWeek! > -0.6, good.trendKgPerWeek);
ok("good: workouts 100%", good.workoutPct === 100, good.workoutPct);
ok("good: nutrition 100%", good.nutritionPct === 100, good.nutritionPct);
ok("good: avg7 is last-7-day mean", good.avg7 === 80.2, good.avg7);

// 2. last check-in 3 days ago, flat weight on a cut, 2 workouts in 14 days, 2/7 days on target
const bad = clientMetrics({
  today, startDate: "2026-10-01", trainingDays: 4,
  weighIns: days(21, 3).map((d) => ({ date: d, kg: 85 })),
  checkinDates: days(21, 3), workoutDates: [addDays(today, -2), addDays(today, -9)],
  nutritionDays: days(2, 1).map((d) => ({ date: d, calories: 2000, protein_g: 160 })), targets: [cut],
});
ok("bad: missed flag (3 days)", bad.flags.includes("missed") && bad.daysSinceCheckin === 3, bad);
ok("bad: stalled flag", bad.flags.includes("stalled"), bad);
ok("bad: low workout (2 of 8 = 25%)", bad.workoutPct === 25 && bad.flags.includes("lowWorkout"), bad.workoutPct);
ok("bad: low nutrition (2/7 = 29%)", bad.nutritionPct === 29 && bad.flags.includes("lowNutrition"), bad.nutritionPct);

// 3. flat weight on maintenance is the goal, not a stall
const maintain = clientMetrics({ ...{ today, startDate: "2026-10-01", trainingDays: 3, checkinDates: days(21), workoutDates: days(6), nutritionDays: [] },
  weighIns: days(21).map((d) => ({ date: d, kg: 70 })), targets: [{ ...cut, phase: "maintain" }] });
ok("maintain: flat weight is not stalled", !maintain.flags.includes("stalled"), maintain.flags);

// 4. brand-new client (joined yesterday): no false alarms
const fresh = clientMetrics({ today, startDate: addDays(today, -1), trainingDays: 3, weighIns: [{ date: today, kg: 90 }],
  checkinDates: [today], workoutDates: [], nutritionDays: [], targets: [] });
ok("new client: no flags", fresh.flags.length === 0, fresh);
ok("new client: no nutrition % without a target", fresh.nutritionPct === null, fresh.nutritionPct);
ok("new client: workout % not shown before a full planned session", fresh.workoutPct === null, fresh.workoutPct);

// 5. never checked in, joined 5 days ago
const silent = clientMetrics({ today, startDate: addDays(today, -5), trainingDays: null, weighIns: [], checkinDates: [], workoutDates: [], nutritionDays: [], targets: [] });
ok("never checked in for 5 days: missed", silent.flags.includes("missed") && silent.lastCheckin === null, silent);

// 6. too few weigh-ins: no stall verdict
const sparse = clientMetrics({ today, startDate: "2026-10-01", trainingDays: 3, checkinDates: days(21), workoutDates: days(6), nutritionDays: [],
  weighIns: [{ date: today, kg: 80 }, { date: addDays(today, -15), kg: 80 }], targets: [cut] });
ok("one weigh-in a week: no stall", !sparse.flags.includes("stalled"), sparse.flags);

// 7. moving average
const s = weightSeries([{ date: "2026-11-01", kg: 80 }, { date: "2026-11-03", kg: 79 }, { date: "2026-11-09", kg: 78 }]);
ok("7-day average uses calendar days", s[1].avg === 79.5 && s[2].avg === 78.5, s);

console.log(`\n${pass}/${pass + fail} passed`);
if (fail) process.exit(1);
