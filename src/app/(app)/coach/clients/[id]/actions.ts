"use server";

import { refresh } from "next/cache";
import { requireCoach } from "@/lib/auth";
import { EXPERIENCE, GOALS } from "@/lib/clients";
import { isISODate, weekStartOf } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { toKg } from "@/lib/units";

const text = (v: FormDataEntryValue | null, max = 1000) => String(v ?? "").trim().slice(0, max) || null;
const num = (v: FormDataEntryValue | null, min: number, max: number) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

/** The coach edits a client's profile (spec #13). */
export async function saveClientProfile(formData: FormData) {
  const coach = await requireCoach();
  const id = String(formData.get("client_id"));
  const supabase = await createClient();
  const name = text(formData.get("full_name"), 80);
  if (name) await supabase.from("profiles").update({ full_name: name }).eq("id", id);
  const birth = String(formData.get("birth_date") ?? "");
  const start = String(formData.get("start_date") ?? "");
  const weight = num(formData.get("starting_weight"), 20, coach.unit === "lb" ? 700 : 320);
  const days = num(formData.get("training_days_per_week"), 1, 7);
  const goal = String(formData.get("goal"));
  const experience = String(formData.get("experience"));
  await supabase
    .from("clients")
    .update({
      whatsapp: text(formData.get("whatsapp"), 30),
      instagram: text(formData.get("instagram"), 60),
      email: text(formData.get("email"), 120),
      birth_date: isISODate(birth) ? birth : null,
      height_cm: num(formData.get("height_cm"), 100, 250),
      starting_weight_kg: weight == null ? null : toKg(weight, coach.unit),
      goal: (GOALS as readonly string[]).includes(goal) ? goal : null,
      experience: (EXPERIENCE as readonly string[]).includes(experience) ? experience : null,
      training_days_per_week: days == null ? null : Math.round(days),
      availability: text(formData.get("availability"), 500),
      injuries: text(formData.get("injuries")),
      start_date: isISODate(start) ? start : null,
    })
    .eq("user_id", id);
  refresh();
}

// ───────── private notes (coach only) ─────────

export async function addCoachNote(formData: FormData) {
  await requireCoach();
  const body = text(formData.get("body"), 4000);
  if (!body) return;
  const supabase = await createClient();
  await supabase.from("coach_notes").insert({ client_id: String(formData.get("client_id")), body });
  refresh();
}

export async function deleteCoachNote(formData: FormData) {
  await requireCoach();
  const supabase = await createClient();
  await supabase.from("coach_notes").delete().eq("id", String(formData.get("id")));
  refresh();
}

// ───────── weekly feedback (the client reads it) ─────────

export async function saveFeedback(formData: FormData) {
  await requireCoach();
  const week = String(formData.get("week"));
  const body = text(formData.get("body"), 6000);
  if (!isISODate(week) || week !== weekStartOf(week)) return;
  const supabase = await createClient();
  const clientId = String(formData.get("client_id"));
  if (!body) {
    await supabase.from("weekly_feedback").delete().eq("client_id", clientId).eq("week_start", week);
  } else {
    // editing feedback marks it unread again, so the client sees the change
    await supabase
      .from("weekly_feedback")
      .upsert({ client_id: clientId, week_start: week, body, read_at: null }, { onConflict: "client_id,week_start" });
  }
  refresh();
}
