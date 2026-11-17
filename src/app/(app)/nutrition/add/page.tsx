import { requireProfile } from "@/lib/auth";
import { dateParam } from "@/lib/dates";
import { getT } from "@/lib/i18n";
import { FOOD_COLUMNS, MEALS, normalizeFood, type Food, type Meal } from "@/lib/nutrition";
import { createClient } from "@/lib/supabase/server";
import { AddFood } from "./AddFood";

export default async function AddFoodPage({ searchParams }: PageProps<"/nutrition/add">) {
  const params = await searchParams;
  const profile = await requireProfile();
  const { locale } = await getT();
  const date = dateParam(params.date);
  const meal: Meal = (MEALS as readonly string[]).includes(String(params.meal)) ? (params.meal as Meal) : "snacks";
  const supabase = await createClient();

  const [{ data: foodRows }, { data: saved }] = await Promise.all([
    supabase.from("foods").select(FOOD_COLUMNS).order(locale === "ar" ? "name_ar" : "name_en"),
    supabase.from("saved_foods").select("food_id").eq("user_id", profile.id),
  ]);

  return (
    <AddFood
      foods={((foodRows ?? []) as Food[]).map(normalizeFood)}
      savedIds={(saved ?? []).map((s) => s.food_id)}
      initialMeal={meal}
      date={date}
    />
  );
}
