"use server";

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
    options: { data: { full_name: String(formData.get("name") ?? "").trim() } },
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
