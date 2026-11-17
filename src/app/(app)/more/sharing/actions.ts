"use server";

import { refresh } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { CONSENT_SCOPES, CONSENT_VERSION, CONSENT_WORDING, type ConsentScope } from "@/lib/consent";
import { getLocale } from "@/lib/i18n";
import { logError } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";

function scopeOf(formData: FormData): ConsentScope | null {
  const s = String(formData.get("scope"));
  return (CONSENT_SCOPES as readonly string[]).includes(s) ? (s as ConsentScope) : null;
}

/** Records the client's permission with the exact wording they saw, in the language they saw it. */
export async function giveConsent(formData: FormData) {
  const profile = await requireProfile();
  const scope = scopeOf(formData);
  if (!scope || profile.role !== "client") return;
  const locale = await getLocale();
  const supabase = await createClient();
  const { error } = await supabase.from("publication_consents").insert({
    client_id: profile.id,
    scope,
    wording_version: CONSENT_VERSION,
    wording: CONSENT_WORDING[scope][locale],
    locale,
  });
  // 23505 = already given (a double tap); nothing to do
  if (error && error.code !== "23505") logError("giveConsent", error);
  refresh();
}

export async function withdrawConsent(formData: FormData) {
  const profile = await requireProfile();
  const scope = scopeOf(formData);
  if (!scope) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("publication_consents")
    .update({ withdrawn_at: new Date().toISOString() })
    .eq("client_id", profile.id)
    .eq("scope", scope)
    .is("withdrawn_at", null);
  logError("withdrawConsent", error);
  refresh();
}
