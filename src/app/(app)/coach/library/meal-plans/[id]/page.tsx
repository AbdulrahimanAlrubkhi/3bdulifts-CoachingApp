import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { FOOD_COLUMNS, normalizeFood, type Food, type Meal } from "@/lib/nutrition";
import { createClient } from "@/lib/supabase/server";
import { PlanBuilder, type BuilderOption } from "./PlanBuilder";

type OptionRow = {
  id: string;
  meal: Meal;
  name_ar: string;
  name_en: string | null;
  position: number;
  meal_option_items: { id: string; food_id: string; grams: number }[];
};

export default async function MealPlanPage({ params }: PageProps<"/coach/library/meal-plans/[id]">) {
  const { id } = await params;
  await requireCoach();
  const { locale } = await getT();
  const supabase = await createClient();

  const [{ data: plan }, { data: foodRows }, { data: clients }] = await Promise.all([
    supabase
      .from("meal_plans")
      .select("id, title, notes, client_id, active, meal_options(id, meal, name_ar, name_en, position, meal_option_items(id, food_id, grams))")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("foods").select(FOOD_COLUMNS).order(locale === "ar" ? "name_ar" : "name_en"),
    supabase.from("profiles").select("id, full_name").eq("role", "client").order("full_name"),
  ]);
  if (!plan) notFound();

  const options: BuilderOption[] = ([...plan.meal_options] as OptionRow[])
    .sort((a, b) => a.position - b.position)
    .map((o) => ({
      key: o.id,
      id: o.id,
      meal: o.meal,
      name_ar: o.name_ar,
      name_en: o.name_en ?? "",
      items: o.meal_option_items.map((i) => ({ key: i.id, food_id: i.food_id, grams: String(Number(i.grams)) })),
    }));

  return (
    <PlanBuilder
      plan={{ id: plan.id, title: plan.title, notes: plan.notes ?? "", client_id: plan.client_id, active: plan.active }}
      initialOptions={options}
      foods={((foodRows ?? []) as Food[]).map(normalizeFood)}
      clients={clients ?? []}
    />
  );
}
