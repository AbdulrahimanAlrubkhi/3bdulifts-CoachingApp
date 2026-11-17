"use server";

import { refresh } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function setUnit(formData: FormData) {
  const profile = await requireProfile();
  const unit = formData.get("unit") === "lb" ? "lb" : "kg";
  const supabase = await createClient();
  await supabase.from("profiles").update({ unit }).eq("id", profile.id);
  refresh();
}
