"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { MEASUREMENTS, POSES, REFLECTIONS, SCALES, photoPath, type Pose } from "@/lib/checkins";
import { isISODate, todayISO, weekStartOf } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { toKg } from "@/lib/units";

/** A number from a form field within [min, max], or null when empty or out of range. */
function num(v: FormDataEntryValue | null, min: number, max: number) {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

export async function saveDailyCheckin(formData: FormData) {
  const profile = await requireProfile();
  const date = String(formData.get("date"));
  // a check-in is for today or a past day, never the future
  if (!isISODate(date) || date > todayISO()) return;

  const weight = num(formData.get("weight"), 20, profile.unit === "lb" ? 700 : 320);
  const row: Record<string, unknown> = {
    user_id: profile.id,
    check_date: date,
    weight_kg: weight == null ? null : toKg(weight, profile.unit),
    steps: num(formData.get("steps"), 0, 150000) == null ? null : Math.round(num(formData.get("steps"), 0, 150000)!),
    sleep_hours: num(formData.get("sleep_hours"), 0, 24),
    notes: String(formData.get("notes") ?? "").trim().slice(0, 2000) || null,
  };
  for (const scale of SCALES) {
    const v = num(formData.get(scale), 1, 5);
    row[scale] = v == null ? null : Math.round(v);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("daily_checkins").upsert(row, { onConflict: "user_id,check_date" });
  redirect(`/checkin?${date === todayISO() ? "" : `date=${date}&`}${error ? "error=1" : "saved=1"}`);
}

export async function saveWeeklyCheckin(formData: FormData) {
  const profile = await requireProfile();
  const week = String(formData.get("week"));
  if (!isISODate(week) || week !== weekStartOf(week) || week > todayISO()) return;

  const row: Record<string, unknown> = { user_id: profile.id, week_start: week };
  for (const m of MEASUREMENTS) row[m] = num(formData.get(m), 10, 300);
  const reflections: Record<string, string | number> = {};
  for (const q of REFLECTIONS) {
    if (q.kind === "score") {
      const v = num(formData.get(`q_${q.key}`), 1, 10);
      if (v != null) reflections[q.key] = Math.round(v);
    } else {
      const text = String(formData.get(`q_${q.key}`) ?? "").trim().slice(0, 2000);
      if (text) reflections[q.key] = text;
    }
  }
  row.reflections = reflections;

  const supabase = await createClient();
  // photo columns are left out, so saving the form never clears uploaded photos
  const { error } = await supabase.from("weekly_checkins").upsert(row, { onConflict: "user_id,week_start" });
  redirect(`/checkin/weekly?${week === weekStartOf(todayISO()) ? "" : `week=${week}&`}${error ? "error=1" : "saved=1"}`);
}

/** Records (or clears) a photo the browser has already uploaded to storage. */
export async function setWeeklyPhoto(week: string, pose: Pose, uploaded: boolean): Promise<{ ok: boolean }> {
  const profile = await requireProfile();
  if (!isISODate(week) || week !== weekStartOf(week) || !(POSES as readonly string[]).includes(pose)) return { ok: false };
  const supabase = await createClient();
  const path = photoPath(profile.id, week, pose);
  if (!uploaded) await supabase.storage.from("progress-photos").remove([path]);
  const { error } = await supabase
    .from("weekly_checkins")
    .upsert({ user_id: profile.id, week_start: week, [`photo_${pose}`]: uploaded ? path : null }, { onConflict: "user_id,week_start" });
  if (!error) refresh();
  return { ok: !error };
}
