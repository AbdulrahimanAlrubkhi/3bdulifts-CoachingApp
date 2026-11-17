"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/env";

export async function login(formData: FormData) {
  if (!supabaseConfigured) redirect("/login");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  if (error) redirect("/login?error=1");
  redirect("/");
}

export async function signup(formData: FormData) {
  if (!supabaseConfigured) redirect("/signup");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    // copied into profiles.full_name by the handle_new_user trigger
    options: {
      data: { full_name: String(formData.get("name") ?? "").trim() },
      // the confirmation email links back here, which signs the new client straight in
      emailRedirectTo: `${await siteOrigin()}/auth/callback`,
    },
  });
  if (error) redirect("/signup?error=1");
  // With email confirmation on, there is no session until the link is opened.
  if (!data.session) redirect("/login?notice=confirm");
  redirect("/");
}

export async function signout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** This site's own address, for links inside emails. */
async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function requestPasswordReset(formData: FormData) {
  if (!supabaseConfigured) redirect("/forgot");
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(String(formData.get("email") ?? "").trim(), {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/reset`,
  });
  // same answer whether or not the address has an account, so nobody can probe for clients
  redirect("/forgot?sent=1");
}

export async function setNewPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) redirect("/reset?error=1");
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  redirect(error ? "/reset?error=1" : "/");
}
