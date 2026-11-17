"use server";

import { refresh } from "next/cache";
import { requireCoach } from "@/lib/auth";
import { logError } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";

/** Allows this email to create a client account (sign-up is by invitation only). */
export async function inviteClient(formData: FormData) {
  await requireCoach();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("client_invites").upsert({ email, note: String(formData.get("note") ?? "").trim() || null });
  logError("inviteClient", error);
  refresh();
}

export async function removeInvite(formData: FormData) {
  await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase.from("client_invites").delete().eq("email", String(formData.get("email")));
  logError("removeInvite", error);
  refresh();
}

/** Archiving hides a client from the dashboard but keeps every record (end of coaching). */
export async function setArchived(formData: FormData) {
  await requireCoach();
  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({ archived: formData.get("archived") === "true" })
    .eq("user_id", String(formData.get("client_id")));
  logError("setArchived", error);
  refresh();
}
