import type { SupabaseClient } from "@supabase/supabase-js";

export const MEALS = ["breakfast", "lunch", "dinner", "snacks"] as const;
export type Meal = (typeof MEALS)[number];
export const PHASES = ["cut", "maintain", "bulk"] as const;
export type Phase = (typeof PHASES)[number];

export type Macros = { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number };
export const ZERO: Macros = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };

export type Food = {
  id: string;
  name_ar: string;
  name_en: string;
  category: string | null;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  fiber_100g: number;
  serving_g: number | null;
  serving_ar: string | null;
  serving_en: string | null;
  is_global: boolean;
};

export const FOOD_COLUMNS =
  "id, name_ar, name_en, category, kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g, serving_g, serving_ar, serving_en, is_global";

export const FOOD_CATEGORIES = [
  "grains", "protein", "dairy", "legumes", "vegetables", "fruit", "nuts", "fats", "sweets", "drinks", "dishes", "fast_food",
] as const;

/** Postgres numerics arrive as strings; this makes every value a number. */
export function normalizeFood<T extends Food>(food: T): T {
  return {
    ...food,
    kcal_100g: Number(food.kcal_100g),
    protein_100g: Number(food.protein_100g),
    carbs_100g: Number(food.carbs_100g),
    fat_100g: Number(food.fat_100g),
    fiber_100g: Number(food.fiber_100g),
    serving_g: food.serving_g == null ? null : Number(food.serving_g),
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Macros for `grams` of a food. */
export function forGrams(food: Food, grams: number): Macros {
  const k = grams / 100;
  return {
    calories: Math.round(food.kcal_100g * k),
    protein_g: round1(food.protein_100g * k),
    carbs_g: round1(food.carbs_100g * k),
    fat_g: round1(food.fat_100g * k),
    fiber_g: round1(food.fiber_100g * k),
  };
}

export function sum(list: Partial<Macros>[]): Macros {
  return list.reduce<Macros>(
    (acc, m) => ({
      calories: acc.calories + Number(m.calories ?? 0),
      protein_g: round1(acc.protein_g + Number(m.protein_g ?? 0)),
      carbs_g: round1(acc.carbs_g + Number(m.carbs_g ?? 0)),
      fat_g: round1(acc.fat_g + Number(m.fat_g ?? 0)),
      fiber_g: round1(acc.fiber_g + Number(m.fiber_g ?? 0)),
    }),
    { ...ZERO },
  );
}

export type Target = {
  id: string;
  phase: Phase;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  water_ml: number | null;
  effective_from: string;
  note: string | null;
};

export const TARGET_COLUMNS = "id, phase, calories, protein_g, carbs_g, fat_g, fiber_g, water_ml, effective_from, note";

/** The target in force on `date`: the latest one that started on or before it. */
export async function targetOn(supabase: SupabaseClient, clientId: string, date: string): Promise<Target | null> {
  const { data } = await supabase
    .from("nutrition_targets")
    .select(TARGET_COLUMNS)
    .eq("client_id", clientId)
    .lte("effective_from", date)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Target | null) ?? null;
}

export type LogRow = Macros & {
  id: string;
  meal: Meal;
  name: string;
  grams: number | null;
  food_id: string | null;
  meal_option_id: string | null;
};

export function normalizeLog(row: LogRow): LogRow {
  return {
    ...row,
    grams: row.grams == null ? null : Number(row.grams),
    calories: Number(row.calories),
    protein_g: Number(row.protein_g),
    carbs_g: Number(row.carbs_g),
    fat_g: Number(row.fat_g),
    fiber_g: Number(row.fiber_g),
  };
}

/** "1,240" */
export function kcal(n: number) {
  return Math.round(n).toLocaleString("en-US");
}

/** "12.5" -> "12.5", "12.0" -> "12" */
export function grams(n: number) {
  return String(Math.round(n * 10) / 10);
}
