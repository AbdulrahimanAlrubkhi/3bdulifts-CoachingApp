"use server";

import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { EXPERIENCE, GOALS, PLACES } from "@/lib/clients";
import { isISODate, todayISO } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { toKg } from "@/lib/units";

const text = (v: FormDataEntryValue | null, max = 500) => String(v ?? "").trim().slice(0, max) || null;
const num = (v: FormDataEntryValue | null, min: number, max: number) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};
const oneOf = <T extends readonly string[]>(list: T, v: FormDataEntryValue | null) =>
  (list as readonly string[]).includes(String(v)) ? String(v) : null;

export async function saveOnboarding(formData: FormData) {
  const profile = await requireProfile();
  if (profile.role !== "client") redirect("/coach");
  const supabase = await createClient();

  const name = text(formData.get("full_name"), 80);
  if (name) await supabase.from("profiles").update({ full_name: name }).eq("id", profile.id);

  const birth = String(formData.get("birth_date") ?? "");
  const weight = num(formData.get("weight"), 20, profile.unit === "lb" ? 700 : 320);
  const days = num(formData.get("training_days"), 1, 7);

  const { error } = await supabase
    .from("clients")
    .update({
      whatsapp: text(formData.get("whatsapp"), 30),
      instagram: text(formData.get("instagram"), 60),
      birth_date: isISODate(birth) && birth < todayISO() ? birth : null,
      height_cm: num(formData.get("height_cm"), 100, 250),
      starting_weight_kg: weight == null ? null : toKg(weight, profile.unit),
      goal: oneOf(GOALS, formData.get("goal")),
      experience: oneOf(EXPERIENCE, formData.get("experience")),
      training_days_per_week: days == null ? null : Math.round(days),
      availability: text(formData.get("availability")),
      injuries: text(formData.get("injuries"), 1000),
      // answers without a column of their own, kept as the client wrote them
      onboarding: {
        goal_detail: text(formData.get("goal_detail"), 1000) ?? "",
        why_now: text(formData.get("why_now"), 1000) ?? "",
        place: oneOf(PLACES, formData.get("place")) ?? "",
        dislikes: text(formData.get("dislikes"), 1000) ?? "",
        meals_per_day: text(formData.get("meals_per_day"), 5) ?? "",
      },
      start_date: todayISO(),
      onboarded_at: new Date().toISOString(),
    })
    .eq("user_id", profile.id);

  if (error) redirect("/onboarding?error=1");
  redirect("/today");
}
