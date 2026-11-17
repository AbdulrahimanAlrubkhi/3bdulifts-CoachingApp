// Run with: npm test
// Known-answer checks for every calculation the app shows to a coach or client.
import { endDateFor, omr, subscriptionState, toCsv, currentSubscription } from "./business";
import { nutritionStatus } from "./checkins";
import { addDays, dateInAppTz, dayBounds, daysBetween, weekStartOf } from "./dates";
import { forGrams, sum, type Food, type Target } from "./nutrition";
import { fmt, parseNum, toDisplay, toKg } from "./units";
import { analyse, type SetStat } from "./workout-stats";
import { matchesSearch } from "./search";

let pass = 0;
let fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++;
  else fail++;
  console.log(ok ? "PASS" : "FAIL", name, ok ? "" : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
};

// ───── dates: Oman day boundaries (UTC+4, no daylight saving) ─────
eq("19:59 UTC is still the same Oman day", dateInAppTz("2026-11-17T19:59:59Z"), "2026-11-17");
eq("20:00 UTC is already the next Oman day", dateInAppTz("2026-11-17T20:00:00Z"), "2026-11-18");
eq("new year's eve in Oman", dateInAppTz("2026-12-31T20:30:00Z"), "2027-01-01");
eq("day bounds are Oman midnight to midnight", dayBounds("2026-11-17"), ["2026-11-17T00:00:00+04:00", "2026-11-18T00:00:00+04:00"]);
eq("addDays across a month end", addDays("2026-01-31", 1), "2026-02-01");
eq("addDays across a leap day", addDays("2028-02-28", 1), "2028-02-29");
eq("addDays backwards across a year", addDays("2027-01-01", -1), "2026-12-31");
eq("week starts on Sunday", weekStartOf("2026-11-17"), "2026-11-15");
eq("a Sunday is its own week start", weekStartOf("2026-11-15"), "2026-11-15");
eq("Saturday belongs to the week that began the Sunday before", weekStartOf("2026-11-21"), "2026-11-15");
eq("week start across a month boundary", weekStartOf("2026-12-02"), "2026-11-29");
eq("week start across a year boundary", weekStartOf("2027-01-01"), "2026-12-27");
eq("days between", daysBetween("2026-11-10", "2026-11-17"), 7);

// ───── units ─────
eq("100 kg shows as 220.5 lb", toDisplay(100, "lb"), 220.5);
eq("225 lb is stored as 102.06 kg", toKg(225, "lb"), 102.06);
eq("lb round trip keeps what was typed", toDisplay(toKg(135, "lb"), "lb"), 135);
eq("kg is unchanged", toKg(82.5, "kg"), 82.5);
eq("decimal comma is accepted", parseNum("82,5"), 82.5);
eq("empty input is 'no value', not zero", parseNum(""), null);
eq("zero is a real value", parseNum("0"), 0);
eq("big numbers get a thousands separator", fmt(12345.6), "12,346");

// ───── food portions ─────
const rice = { kcal_100g: 130, protein_100g: 2.7, carbs_100g: 28.2, fat_100g: 0.3, fiber_100g: 0.4 } as Food;
eq("150 g of cooked rice", forGrams(rice, 150), { calories: 195, protein_g: 4.1, carbs_g: 42.3, fat_g: 0.5, fiber_g: 0.6 });
eq("decimal grams scale correctly", forGrams(rice, 12.5).calories, 16);
eq("0 g is nothing", forGrams(rice, 0).calories, 0);
eq("meal total adds up", sum([{ calories: 195, protein_g: 4.1 }, { calories: 165, protein_g: 31 }]), { calories: 360, protein_g: 35.1, carbs_g: 0, fat_g: 0, fiber_g: 0 });
eq("totals keep one decimal (no float noise)", sum([{ protein_g: 0.1 }, { protein_g: 0.2 }]).protein_g, 0.3);

// ───── nutrition status ─────
const target = { calories: 2000, protein_g: 150 } as Target;
const day = (calories: number, protein_g: number) => ({ calories, protein_g, carbs_g: 0, fat_g: 0, fiber_g: 0 });
eq("within 10% and enough protein = on target", nutritionStatus(day(1850, 140), target, true).status, "on");
eq("exactly 90% calories counts", nutritionStatus(day(1800, 135), target, true).status, "on");
eq("over 110% = over", nutritionStatus(day(2201, 150), target, true).status, "over");
eq("calories fine but protein short = under", nutritionStatus(day(2000, 100), target, true).status, "under");
eq("nothing logged = no verdict", nutritionStatus(day(0, 0), target, false).status, "none");
eq("no target = no verdict", nutritionStatus(day(2000, 150), null, true).status, "none");

// ───── workouts: volume, estimated 1RM (Epley), PRs ─────
const set = (id: string, workout: string, at: string, kg: number, reps: number): SetStat => ({
  set_id: id, exercise_id: "bench", workout_id: workout, started_at: at, weight_kg: kg, reps,
  volume_kg: kg * reps, est_1rm_kg: Math.round(kg * (1 + reps / 30) * 10) / 10,
});
const { workouts, records, sessions } = analyse([
  set("a1", "w1", "2026-11-01", 80, 8), set("a2", "w1", "2026-11-01", 80, 6),
  set("b1", "w2", "2026-11-08", 85, 8),
  set("c1", "w3", "2026-11-15", 82.5, 5),
]);
eq("est. 1RM of 85 x 8 (Epley)", set("x", "w", "d", 85, 8).est_1rm_kg, 107.7);
eq("workout volume = sum of weight x reps", workouts.get("w1")!.volume_kg, 1120);
eq("first session is a baseline, not a PR", workouts.get("w1")!.prSetIds.size, 0);
eq("beating the best est. 1RM is a PR", [...workouts.get("w2")!.prSetIds], ["b1"]);
eq("a lighter session is not a PR", workouts.get("w3")!.prSetIds.size, 0);
eq("record keeps the best est. 1RM and when it happened", [records.get("bench")!.best_est_1rm_kg, records.get("bench")!.best_est_1rm_at], [107.7, "2026-11-08"]);
eq("chart has one point per session", sessions.get("bench")!.length, 3);

// ───── subscriptions ─────
eq("1 month from the 1st ends on the last day", endDateFor("2026-11-01", 1), "2026-11-30");
eq("1 month from 31 Jan ends 27 Feb (next plan starts 28 Feb)", endDateFor("2026-01-31", 1), "2026-02-27");
eq("1 month from 31 Jan in a leap year", endDateFor("2028-01-31", 1), "2028-02-28");
eq("3 months across a year end", endDateFor("2026-11-17", 3), "2027-02-16");
eq("6 months", endDateFor("2026-08-31", 6), "2027-02-27");
const sub = { start_date: "2026-11-01", end_date: "2026-11-30", reminder_days_before: 7 };
eq("states around the reminder window and last day",
  ["2026-10-31", "2026-11-22", "2026-11-23", "2026-11-30", "2026-12-01"].map((d) => subscriptionState(sub, d)),
  ["upcoming", "active", "ending", "ending", "ended"]);
eq("a renewed client shows the running plan", currentSubscription([{ start_date: "2026-08-01", end_date: "2026-10-31" }, { start_date: "2026-11-01", end_date: "2027-01-31" }], "2026-11-17")?.start_date, "2026-11-01");
eq("OMR shows three decimals", omr(25), "25.000");
eq("OMR keeps baisa", omr(12.345), "12.345");

// ───── CSV export ─────
const csv = toCsv(["a"], [["=HYPERLINK(\"http://x\")"], ["+cmd"], ["-2+3"], ["@SUM(A1)"], ["2026-10-13"], ["-3.6"], [-3.6], ["عادي"], ["has,comma"]]);
const cells = csv.replace(/^﻿/, "").trim().split("\r\n").slice(1);
eq("formulas are neutralised, dates and numbers are not", cells, [
  "\"'=HYPERLINK(\"\"http://x\"\")\"", "'+cmd", "'-2+3", "'@SUM(A1)", "2026-10-13", "-3.6", "-3.6", "عادي", "\"has,comma\"",
]);
eq("CSV starts with a byte-order mark for Excel", csv.charCodeAt(0), 0xfeff);

// ───── Arabic-friendly search ─────
eq("ارز finds أرز", matchesSearch("ارز", "أرز أبيض مطبوخ", "White rice, cooked"), true);
eq("دجاجه finds دجاجة", matchesSearch("دجاجه", "صدر دجاجة", "x"), true);
eq("words in any order", matchesSearch("مطبوخ ارز", "أرز أبيض مطبوخ", "x"), true);
eq("English ignores case", matchesSearch("RICE", "x", "White rice"), true);
eq("no false match", matchesSearch("سمك", "أرز", "rice"), false);
eq("dialect alias finds rice", matchesSearch("عيش", "أرز أبيض مطبوخ", "White rice, cooked", "عيش رز"), true);
eq("alias plus state word", matchesSearch("روبيان نيء", "روبيان نيء", "Shrimp, raw", "جمبري ربيان"), true);
eq("cooked does not match raw", matchesSearch("مطبوخ", "روبيان نيء", "Shrimp, raw", "جمبري"), false);

console.log(`\n${pass}/${pass + fail} passed`);
if (fail) process.exit(1);
