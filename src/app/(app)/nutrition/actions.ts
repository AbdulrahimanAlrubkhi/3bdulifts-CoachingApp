"use server";

import { refresh } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { isISODate } from "@/lib/dates";
import { getLocale } from "@/lib/i18n";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { FOOD_COLUMNS, MEALS, forGrams, normalizeFood, type Food, type Meal } from "@/lib/nutrition";
import { createClient } from "@/lib/supabase/server";

// Every write is made as the signed-in client; macros are always worked out here from the
// food database, never taken from the browser.

function checkMealAndDate(meal: string, date: string): meal is Meal {
  return (MEALS as readonly string[]).includes(meal) && isISODate(date);
}

export async function addFoodLog(input: { food_id: string; grams: number; meal: string; date: string }): Promise<{ ok: boolean }> {
  const profile = await requireProfile();
  if (!checkMealAndDate(input.meal, input.date) || !(input.grams > 0) || input.grams > 5000) return { ok: false };
  const supabase = await createClient();
  const { data } = await supabase.from("foods").select(FOOD_COLUMNS).eq("id", input.food_id).maybeSingle();
  if (!data) return { ok: false };
  const locale = await getLocale();
  const food = normalizeFood(data as Food);
  const { error } = await supabase.from("food_logs").insert({
    user_id: profile.id,
    log_date: input.date,
    meal: input.meal,
    food_id: food.id,
    name: locale === "ar" ? food.name_ar : food.name_en,
    grams: Math.round(input.grams * 10) / 10,
    ...forGrams(food, input.grams),
  });
  return { ok: !error };
}

export async function addQuickLog(input: {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meal: string;
  date: string;
}): Promise<{ ok: boolean }> {
  const profile = await requireProfile();
  if (!checkMealAndDate(input.meal, input.date)) return { ok: false };
  const clamp = (n: number, max: number) => (Number.isFinite(n) ? Math.min(max, Math.max(0, Math.round(n * 10) / 10)) : 0);
  const calories = clamp(input.calories, 20000);
  if (!calories && !input.protein_g && !input.carbs_g && !input.fat_g) return { ok: false };
  const locale = await getLocale();
  const supabase = await createClient();
  const { error } = await supabase.from("food_logs").insert({
    user_id: profile.id,
    log_date: input.date,
    meal: input.meal,
    name: input.name.trim().slice(0, 80) || dictionaries[locale]["n.quickDefault"],
    calories,
    protein_g: clamp(input.protein_g, 2000),
    carbs_g: clamp(input.carbs_g, 2000),
    fat_g: clamp(input.fat_g, 2000),
  });
  return { ok: !error };
}

export async function deleteFoodLog(formData: FormData) {
  await requireProfile();
  const supabase = await createClient();
  await supabase.from("food_logs").delete().eq("id", String(formData.get("id")));
  refresh();
}

export async function toggleSavedFood(foodId: string, save: boolean): Promise<{ ok: boolean }> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = save
    ? await supabase.from("saved_foods").upsert({ user_id: profile.id, food_id: foodId })
    : await supabase.from("saved_foods").delete().eq("user_id", profile.id).eq("food_id", foodId);
  return { ok: !error };
}

export async function changeWater(formData: FormData) {
  const profile = await requireProfile();
  const date = String(formData.get("date"));
  const delta = Number(formData.get("delta"));
  if (!isISODate(date) || ![-250, 250, 500].includes(delta)) return;
  const supabase = await createClient();
  const { data } = await supabase.from("water_logs").select("ml").eq("user_id", profile.id).eq("log_date", date).maybeSingle();
  const ml = Math.max(0, (data?.ml ?? 0) + delta);
  await supabase.from("water_logs").upsert({ user_id: profile.id, log_date: date, ml });
  refresh();
}

/** Logs every item of a meal-plan option as its own entry, tagged with the option. */
export async function logMealOption(formData: FormData) {
  const profile = await requireProfile();
  const optionId = String(formData.get("option_id"));
  const date = String(formData.get("date"));
  if (!isISODate(date)) return;
  const supabase = await createClient();
  // a double tap or a retry must not log the same option twice for the same day
  const { count } = await supabase
    .from("food_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .eq("log_date", date)
    .eq("meal_option_id", optionId);
  if (count) {
    refresh();
    return;
  }
  const { data: option } = await supabase
    .from("meal_options")
    .select(`meal, meal_option_items(grams, foods(${FOOD_COLUMNS}))`)
    .eq("id", optionId)
    .maybeSingle();
  if (!option) return;
  const locale = await getLocale();
  type Item = { grams: number; foods: Food };
  const rows = (option.meal_option_items as unknown as Item[]).map((item) => {
    const food = normalizeFood(item.foods);
    return {
      user_id: profile.id,
      log_date: date,
      meal: option.meal,
      food_id: food.id,
      meal_option_id: optionId,
      name: locale === "ar" ? food.name_ar : food.name_en,
      grams: Number(item.grams),
      ...forGrams(food, Number(item.grams)),
    };
  });
  if (rows.length) await supabase.from("food_logs").insert(rows);
  refresh();
}

export async function unlogMealOption(formData: FormData) {
  const profile = await requireProfile();
  const date = String(formData.get("date"));
  if (!isISODate(date)) return;
  const supabase = await createClient();
  await supabase
    .from("food_logs")
    .delete()
    .eq("user_id", profile.id)
    .eq("log_date", date)
    .eq("meal_option_id", String(formData.get("option_id")));
  refresh();
}
