import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { supabaseConfigured } from "./supabase/env";

export type Profile = {
  id: string;
  role: "coach" | "client";
  full_name: string;
  unit: "kg" | "lb";
  /** false until a client has filled in the onboarding questionnaire; always true for the coach */
  onboarded: boolean;
};

/** The signed-in user's profile, or null. Verified against Supabase on every request. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  await connection(); // always a per-request read, so signed-in pages are never prerendered
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, role, full_name, unit, clients(onboarded_at)")
    .eq("id", auth.user.id)
    .single();
  if (!data) return null;
  const client = Array.isArray(data.clients) ? data.clients[0] : data.clients;
  return {
    id: data.id,
    role: data.role,
    full_name: data.full_name,
    unit: data.unit,
    onboarded: data.role === "coach" || Boolean(client?.onboarded_at),
  };
});

export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireCoach(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "coach") redirect("/today");
  return profile;
}

export function homeFor(profile: Profile) {
  return profile.role === "coach" ? "/coach" : "/today";
}
