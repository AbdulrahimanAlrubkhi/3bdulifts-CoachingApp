"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireCoach } from "@/lib/auth";
import { PLANS, endDateFor } from "@/lib/business";
import { isISODate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { toKg } from "@/lib/units";

// Coach-only writes for subscriptions, challenges and wins (spec #18–20).

const text = (v: FormDataEntryValue | null, max = 1000) => String(v ?? "").trim().slice(0, max) || null;
const num = (v: FormDataEntryValue | null, min: number, max: number) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

// ───────── subscriptions ─────────

export async function createSubscription(formData: FormData) {
  await requireCoach();
  const months = Number(formData.get("plan_months"));
  const start = String(formData.get("start_date"));
  const price = num(formData.get("price_omr"), 0, 100000);
  if (!(PLANS as readonly number[]).includes(months) || !isISODate(start) || price == null) return;
  const supabase = await createClient();
  await supabase.from("subscriptions").insert({
    client_id: String(formData.get("client_id")),
    plan_months: months,
    price_omr: price,
    start_date: start,
    end_date: endDateFor(start, months),
    payment_status: formData.get("payment_status") === "paid" ? "paid" : "pending",
    reminder_days_before: Math.round(num(formData.get("reminder_days_before"), 0, 60) ?? 7),
    notes: text(formData.get("notes")),
  });
  refresh();
}

export async function setPaymentStatus(formData: FormData) {
  await requireCoach();
  const supabase = await createClient();
  await supabase
    .from("subscriptions")
    .update({ payment_status: formData.get("status") === "paid" ? "paid" : "pending" })
    .eq("id", String(formData.get("id")));
  refresh();
}

export async function markReminded(formData: FormData) {
  await requireCoach();
  const supabase = await createClient();
  await supabase.from("subscriptions").update({ reminded_at: new Date().toISOString() }).eq("id", String(formData.get("id")));
  refresh();
}

export async function deleteSubscription(formData: FormData) {
  await requireCoach();
  const supabase = await createClient();
  await supabase.from("subscriptions").delete().eq("id", String(formData.get("id")));
  refresh();
}

// ───────── challenges ─────────

export async function saveChallenge(formData: FormData) {
  await requireCoach();
  const id = text(formData.get("id"));
  const start = String(formData.get("start_date"));
  const end = String(formData.get("end_date"));
  const title = text(formData.get("title"), 120);
  if (!title || !isISODate(start) || !isISODate(end) || end < start) return;
  const row = { title, description: text(formData.get("description"), 2000), start_date: start, end_date: end };
  const supabase = await createClient();
  if (id) {
    await supabase.from("challenges").update(row).eq("id", id);
    refresh();
    return;
  }
  const { data } = await supabase.from("challenges").insert(row).select("id").single();
  redirect(data ? `/coach/business/challenges/${data.id}` : "/coach/business/challenges");
}

/** Replaces the member list with the ticked clients. */
export async function saveChallengeMembers(formData: FormData) {
  await requireCoach();
  const id = String(formData.get("challenge_id"));
  const members = formData.getAll("member").map(String);
  const supabase = await createClient();
  const { data: current } = await supabase.from("challenge_members").select("client_id").eq("challenge_id", id);
  const have = new Set((current ?? []).map((m) => m.client_id));
  const removed = [...have].filter((c) => !members.includes(c));
  const added = members.filter((c) => !have.has(c));
  if (removed.length) await supabase.from("challenge_members").delete().eq("challenge_id", id).in("client_id", removed);
  if (added.length) await supabase.from("challenge_members").insert(added.map((client_id) => ({ challenge_id: id, client_id })));
  refresh();
}

export async function deleteChallenge(formData: FormData) {
  await requireCoach();
  const supabase = await createClient();
  await supabase.from("challenges").delete().eq("id", String(formData.get("id")));
  redirect("/coach/business/challenges");
}

// ───────── wins / testimonials ─────────

export async function saveWin(formData: FormData) {
  const coach = await requireCoach();
  const id = text(formData.get("id"));
  const title = text(formData.get("title"), 160);
  if (!title) return;
  const weight = (name: string) => {
    const v = num(formData.get(name), 20, coach.unit === "lb" ? 700 : 320);
    return v == null ? null : toKg(v, coach.unit);
  };
  const row = {
    client_id: text(formData.get("client_id")),
    title,
    quote: text(formData.get("quote"), 3000),
    weeks: num(formData.get("weeks"), 0, 520) == null ? null : Math.round(num(formData.get("weeks"), 0, 520)!),
    before_weight_kg: weight("before_weight"),
    after_weight_kg: weight("after_weight"),
    before_waist_cm: num(formData.get("before_waist_cm"), 10, 300),
    after_waist_cm: num(formData.get("after_waist_cm"), 10, 300),
    before_photo: text(formData.get("before_photo"), 300),
    after_photo: text(formData.get("after_photo"), 300),
    consent_given: formData.get("consent_given") === "on",
  };
  const supabase = await createClient();
  if (id) await supabase.from("testimonials").update(row).eq("id", id);
  else await supabase.from("testimonials").insert(row);
  redirect("/coach/business/wins");
}

export async function deleteWin(formData: FormData) {
  await requireCoach();
  const supabase = await createClient();
  await supabase.from("testimonials").delete().eq("id", String(formData.get("id")));
  redirect("/coach/business/wins");
}
