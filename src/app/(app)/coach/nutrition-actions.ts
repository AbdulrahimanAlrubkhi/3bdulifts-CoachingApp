"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireCoach } from "@/lib/auth";
import { isISODate, todayISO } from "@/lib/dates";
import { getLocale } from "@/lib/i18n";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { FOOD_CATEGORIES, MEALS, PHASES } from "@/lib/nutrition";
import { createClient } from "@/lib/supabase/server";

// Coach-only writes. requireCoach() stops clients at the door; row-level security stops them again in the database.

const num = (v: FormDataEntryValue | null) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const text = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;

// ───────── targets ─────────

export async function saveTarget(formData: FormData) {
  await requireCoach();
  const clientId = String(formData.get("client_id"));
  const phase = String(formData.get("phase"));
  const calories = num(formData.get("calories"));
  const protein = num(formData.get("protein_g"));
  const carbs = num(formData.get("carbs_g"));
  const fat = num(formData.get("fat_g"));
  const from = String(formData.get("effective_from"));
  if (!(PHASES as readonly string[]).includes(phase) || calories == null || protein == null || carbs == null || fat == null) return;

  const supabase = await createClient();
  // one target per start date: saving again on the same date corrects it instead of adding a duplicate
  await supabase.from("nutrition_targets").upsert(
    {
      client_id: clientId,
      phase,
      calories: Math.round(calories),
      protein_g: Math.round(protein),
      carbs_g: Math.round(carbs),
      fat_g: Math.round(fat),
      fiber_g: num(formData.get("fiber_g")) == null ? null : Math.round(num(formData.get("fiber_g"))!),
      water_ml: num(formData.get("water_ml")) == null ? null : Math.round(num(formData.get("water_ml"))!),
      effective_from: isISODate(from) ? from : todayISO(),
      note: text(formData.get("note")),
    },
    { onConflict: "client_id,effective_from" },
  );
  refresh();
}

export async function deleteTarget(formData: FormData) {
  await requireCoach();
  const supabase = await createClient();
  await supabase.from("nutrition_targets").delete().eq("id", String(formData.get("id")));
  refresh();
}

// ───────── food database ─────────

export async function saveFood(formData: FormData) {
  const profile = await requireCoach();
  const id = text(formData.get("id"));
  const nameAr = text(formData.get("name_ar"));
  const nameEn = text(formData.get("name_en"));
  const kcal = num(formData.get("kcal_100g"));
  if ((!nameAr && !nameEn) || kcal == null) return;
  const category = String(formData.get("category"));

  const row = {
    name_ar: nameAr ?? nameEn!,
    name_en: nameEn ?? nameAr!,
    category: (FOOD_CATEGORIES as readonly string[]).includes(category) ? category : null,
    kcal_100g: kcal,
    protein_100g: num(formData.get("protein_100g")) ?? 0,
    carbs_100g: num(formData.get("carbs_100g")) ?? 0,
    fat_100g: num(formData.get("fat_100g")) ?? 0,
    fiber_100g: num(formData.get("fiber_100g")) ?? 0,
    serving_g: num(formData.get("serving_g")),
    serving_ar: text(formData.get("serving_ar")),
    serving_en: text(formData.get("serving_en")),
    is_estimate: formData.get("is_estimate") === "on",
  };

  const supabase = await createClient();
  if (id) await supabase.from("foods").update(row).eq("id", id);
  else await supabase.from("foods").insert({ ...row, is_global: true, created_by: profile.id });
  redirect("/coach/library/foods");
}

export async function deleteFood(formData: FormData) {
  await requireCoach();
  const id = String(formData.get("id"));
  const supabase = await createClient();
  // meal plan items keep the food they point at, so a food in use cannot be removed
  const { error } = await supabase.from("foods").delete().eq("id", id);
  redirect(error ? `/coach/library/foods/${id}?inuse=1` : "/coach/library/foods");
}

// ───────── meal plans ─────────

export async function createMealPlan(formData: FormData) {
  await requireCoach();
  const locale = await getLocale();
  const supabase = await createClient();
  const { data } = await supabase
    .from("meal_plans")
    .insert({
      title: text(formData.get("title")) ?? dictionaries[locale]["n.newPlan"],
      client_id: text(formData.get("client_id")),
    })
    .select("id")
    .single();
  redirect(data ? `/coach/library/meal-plans/${data.id}` : "/coach/library/meal-plans");
}

export type PlanInput = {
  title: string;
  notes: string;
  client_id: string | null;
  active: boolean;
  options: {
    id: string | null; // null for a new option
    meal: string;
    name_ar: string;
    name_en: string;
    items: { food_id: string; grams: number }[];
  }[];
};

/** Returns each option's id in input order, so new options can be updated on the next save. */
export async function saveMealPlan(planId: string, input: PlanInput): Promise<{ ok: boolean; ids: (string | null)[] }> {
  const ids: (string | null)[] = [];
  const fail = { ok: false, ids };
  await requireCoach();
  const supabase = await createClient();

  const { error } = await supabase
    .from("meal_plans")
    .update({ title: input.title.trim() || "—", notes: input.notes.trim() || null, client_id: input.client_id, active: input.active })
    .eq("id", planId);
  if (error) return fail;

  // Options keep their ids across saves, so a client's "logged" marks survive the coach editing the plan.
  const { data: existing } = await supabase.from("meal_options").select("id").eq("meal_plan_id", planId);
  const keep = new Set(input.options.map((o) => o.id).filter(Boolean));
  const removed = (existing ?? []).map((o) => o.id).filter((id) => !keep.has(id));
  if (removed.length) await supabase.from("meal_options").delete().in("id", removed);

  for (const [index, option] of input.options.entries()) {
    if (!(MEALS as readonly string[]).includes(option.meal)) {
      ids.push(null);
      continue;
    }
    const fields = {
      meal_plan_id: planId,
      meal: option.meal,
      name_ar: option.name_ar.trim() || option.name_en.trim() || "—",
      name_en: option.name_en.trim() || null,
      position: index,
    };
    let optionId = option.id;
    if (optionId) {
      const { error: updateError } = await supabase.from("meal_options").update(fields).eq("id", optionId);
      if (updateError) return fail;
      await supabase.from("meal_option_items").delete().eq("meal_option_id", optionId);
    } else {
      const { data, error: insertError } = await supabase.from("meal_options").insert(fields).select("id").single();
      if (insertError || !data) return fail;
      optionId = data.id;
    }
    ids.push(optionId);
    const items = option.items.filter((i) => i.grams > 0);
    if (items.length) {
      const { error: itemsError } = await supabase
        .from("meal_option_items")
        .insert(items.map((i) => ({ meal_option_id: optionId, food_id: i.food_id, grams: Math.round(i.grams * 10) / 10 })));
      if (itemsError) return fail;
    }
  }
  return { ok: true, ids };
}

export async function deleteMealPlan(formData: FormData) {
  await requireCoach();
  const supabase = await createClient();
  await supabase.from("meal_plans").delete().eq("id", String(formData.get("id")));
  redirect("/coach/library/meal-plans");
}

/** Copies a plan with all its options and items, paused, so it can be pointed at another client. */
export async function duplicateMealPlan(formData: FormData) {
  await requireCoach();
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("meal_plans")
    .select("title, notes, client_id, meal_options(meal, name_ar, name_en, position, meal_option_items(food_id, grams))")
    .eq("id", String(formData.get("id")))
    .single();
  if (!plan) redirect("/coach/library/meal-plans");

  const { data: copy } = await supabase
    .from("meal_plans")
    .insert({ title: `${plan.title} (${dictionaries[locale]["n.copy"]})`, notes: plan.notes, client_id: plan.client_id, active: false })
    .select("id")
    .single();
  if (!copy) redirect("/coach/library/meal-plans");

  for (const option of plan.meal_options) {
    const { data: newOption } = await supabase
      .from("meal_options")
      .insert({ meal_plan_id: copy.id, meal: option.meal, name_ar: option.name_ar, name_en: option.name_en, position: option.position })
      .select("id")
      .single();
    if (newOption && option.meal_option_items.length) {
      await supabase
        .from("meal_option_items")
        .insert(option.meal_option_items.map((i) => ({ meal_option_id: newOption.id, food_id: i.food_id, grams: i.grams })));
    }
  }
  redirect(`/coach/library/meal-plans/${copy.id}`);
}
