import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { dateParam, formatDay, todayISO } from "@/lib/dates";
import { getT } from "@/lib/i18n";
import { MEALS, type Meal } from "@/lib/nutrition";
import { createClient } from "@/lib/supabase/server";
import { MacroLine } from "@/components/MacroLine";
import { Card, PageTitle, ghostButtonClass } from "@/components/ui";
import { logMealOption, unlogMealOption } from "../actions";

type OptionRow = {
  id: string;
  meal: Meal;
  name_ar: string;
  name_en: string | null;
  position: number;
  meal_option_items: { grams: number; foods: { name_ar: string; name_en: string } }[];
};

export default async function MealPlanPickPage({ searchParams }: PageProps<"/nutrition/plan">) {
  const profile = await requireProfile();
  const { t, locale } = await getT();
  const date = dateParam((await searchParams).date);
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id, title, notes, meal_options(id, meal, name_ar, name_en, position, meal_option_items(grams, foods(name_ar, name_en)))")
    .eq("client_id", profile.id)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!plan) {
    return (
      <>
        <PageTitle>{t("n.plan")}</PageTitle>
        <Card>
          <p className="text-sm text-muted">{t("n.noPlan")}</p>
        </Card>
      </>
    );
  }

  const options = ([...plan.meal_options] as unknown as OptionRow[]).sort((a, b) => a.position - b.position);
  const ids = options.map((o) => o.id);
  const [{ data: totals }, { data: logged }] = await Promise.all([
    ids.length ? supabase.from("v_meal_option_totals").select("*").in("meal_option_id", ids) : { data: [] },
    ids.length
      ? supabase.from("food_logs").select("meal_option_id").eq("user_id", profile.id).eq("log_date", date).in("meal_option_id", ids)
      : { data: [] },
  ]);
  const totalsById = new Map((totals ?? []).map((row) => [row.meal_option_id as string, row]));
  const loggedIds = new Set((logged ?? []).map((row) => row.meal_option_id));
  const nm = (x: { name_ar: string; name_en: string | null }) => (locale === "ar" ? x.name_ar : x.name_en || x.name_ar);

  return (
    <>
      <PageTitle>{plan.title}</PageTitle>
      <p className="-mt-3 mb-1 text-sm text-muted">
        {date === todayISO() ? t("n.today") : formatDay(date, locale, { weekday: "long", day: "numeric", month: "long" })}
      </p>
      <p className="mb-4 text-sm text-muted">{t("n.planIntro")}</p>
      {plan.notes && <p className="mb-4 text-sm whitespace-pre-wrap">{plan.notes}</p>}

      <div className="space-y-5">
        {MEALS.map((meal) => {
          const mealOptions = options.filter((o) => o.meal === meal);
          if (!mealOptions.length) return null;
          return (
            <section key={meal}>
              <h2 className="mb-2 text-sm font-medium text-muted">{t(`meal.${meal}`)}</h2>
              <ul className="space-y-2">
                {mealOptions.map((option) => {
                  const total = totalsById.get(option.id);
                  const isLogged = loggedIds.has(option.id);
                  return (
                    <li key={option.id}>
                      <Card className={`p-3 ${isLogged ? "border-accent" : ""}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-[15px] font-medium">{nm(option)}</h3>
                            <p className="mt-0.5 text-xs text-muted">
                              {option.meal_option_items.map((i) => `${nm(i.foods)} ${Number(i.grams)}${t("n.g")}`).join(" · ")}
                            </p>
                            {total && (
                              <MacroLine
                                className="mt-1 block"
                                m={{
                                  calories: Number(total.calories),
                                  protein_g: Number(total.protein_g),
                                  carbs_g: Number(total.carbs_g),
                                  fat_g: Number(total.fat_g),
                                  fiber_g: Number(total.fiber_g),
                                }}
                              />
                            )}
                          </div>
                          <form action={isLogged ? unlogMealOption : logMealOption} className="shrink-0">
                            <input type="hidden" name="option_id" value={option.id} />
                            <input type="hidden" name="date" value={date} />
                            {isLogged ? (
                              <span className="flex flex-col items-end gap-1">
                                <span className="text-xs text-accent">✓ {t("n.logged")}</span>
                                <button className={`${ghostButtonClass} h-8 text-xs`}>{t("n.undo")}</button>
                              </span>
                            ) : (
                              <button
                                disabled={!option.meal_option_items.length}
                                className={`${ghostButtonClass} border-accent text-accent disabled:opacity-40`}
                              >
                                {t("n.log")}
                              </button>
                            )}
                          </form>
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <Link href={date === todayISO() ? "/nutrition" : `/nutrition?date=${date}`} className={`${ghostButtonClass} mt-6 flex w-full items-center justify-center`}>
        {t("nav.nutrition")}
      </Link>
    </>
  );
}
