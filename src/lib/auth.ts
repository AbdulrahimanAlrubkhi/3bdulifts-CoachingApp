import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { supabaseConfigured } from "./supabase/env";

export type Profile = {
  id: string;
  role: "coach" | "client";
  full_name: string;
  unit: "kg" | "lb";
};

/** The signed-in user's profile, or null. Verified against Supabase on every request. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  await cookies(); // always a per-request read, so signed-in pages are never prerendered
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, role, full_name, unit")
    .eq("id", auth.user.id)
    .single();
  return (data as Profile | null) ?? null;
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
