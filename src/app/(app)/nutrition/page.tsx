import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { addDays, dateParam, formatDay, todayISO } from "@/lib/dates";
import { getT } from "@/lib/i18n";
import { MEALS, grams, kcal, normalizeLog, sum, targetOn, type LogRow } from "@/lib/nutrition";
import { createClient } from "@/lib/supabase/server";
import { MacroBars } from "@/components/MacroBars";
import { Card, ghostButtonClass, accentButtonClass } from "@/components/ui";
import { changeWater, deleteFoodLog } from "./actions";

export default async function NutritionPage({ searchParams }: PageProps<"/nutrition">) {
  const profile = await requireProfile();
  const { t, locale } = await getT();
  const date = dateParam((await searchParams).date);
  const today = todayISO();
  const supabase = await createClient();

  const [target, { data: logRows }, { data: water }, { count: planCount }] = await Promise.all([
    targetOn(supabase, profile.id, date),
    supabase
      .from("food_logs")
      .select("id, meal, name, grams, food_id, meal_option_id, calories, protein_g, carbs_g, fat_g, fiber_g")
      .eq("user_id", profile.id)
      .eq("log_date", date)
      .order("created_at"),
    supabase.from("water_logs").select("ml").eq("user_id", profile.id).eq("log_date", date).maybeSingle(),
    supabase.from("meal_plans").select("id", { count: "exact", head: true }).eq("client_id", profile.id).eq("active", true),
  ]);
  const logs = ((logRows ?? []) as LogRow[]).map(normalizeLog);
  const totals = sum(logs);
  const waterMl = water?.ml ?? 0;
  const q = (d: string) => (d === today ? "/nutrition" : `/nutrition?date=${d}`);
  const arrow = "flex h-9 w-9 items-center justify-center rounded-md border border-line text-muted hover:text-text";

  return (
    <>
      {/* day switcher; arrows point the reading direction in both languages */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link href={q(addDays(date, -1))} aria-label={t("n.prevDay")} className={arrow}>
          <span className="inline-block rtl:rotate-180">‹</span>
        </Link>
        <h1 className="text-center text-lg font-semibold tracking-tight">
          {date === today ? t("n.today") : formatDay(date, locale, { weekday: "long", day: "numeric", month: "long" })}
        </h1>
        {date < today ? (
          <Link href={q(addDays(date, 1))} aria-label={t("n.nextDay")} className={arrow}>
            <span className="inline-block rtl:rotate-180">›</span>
          </Link>
        ) : (
          <span className="h-9 w-9" />
        )}
      </div>

      <Card className="mb-3">
        {!target && <p className="mb-3 text-sm text-muted">{t("n.noTarget")}</p>}
        <MacroBars totals={totals} target={target} t={t} />
      </Card>

      <Card className="mb-3 flex items-center justify-between gap-3">
        <div>
          <span className="text-sm">{t("n.water")}</span>
          <p className="text-sm">
            <span className="num">{waterMl.toLocaleString("en-US")}</span>
            {target?.water_ml ? (
              <span className="text-muted">
                {" "}
                / <span className="num">{target.water_ml.toLocaleString("en-US")}</span>
              </span>
            ) : null}{" "}
            <span className="text-xs text-muted">{t("n.ml")}</span>
          </p>
        </div>
        <form action={changeWater} className="flex gap-2">
          <input type="hidden" name="date" value={date} />
          <button name="delta" value="-250" disabled={waterMl === 0} className={`${ghostButtonClass} num disabled:opacity-40`}>
            −250
          </button>
          <button name="delta" value="250" className={`${accentButtonClass} num`}>
            +250
          </button>
        </form>
      </Card>

      <div className="mb-3 grid grid-cols-2 gap-2 text-center text-sm">
        {planCount ? (
          <Link href={`/nutrition/plan${date === today ? "" : `?date=${date}`}`} className="rounded-md border border-line px-2 py-2.5 text-muted hover:text-text">
            {t("n.plan")}
          </Link>
        ) : (
          <span />
        )}
        <Link href={`/nutrition/week${date === today ? "" : `?date=${date}`}`} className="rounded-md border border-line px-2 py-2.5 text-muted hover:text-text">
          {t("n.week")}
        </Link>
      </div>

      <div className="space-y-3">
        {MEALS.map((meal) => {
          const items = logs.filter((l) => l.meal === meal);
          const mealTotal = sum(items);
          return (
            <Card key={meal} className="p-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[15px] font-medium">{t(`meal.${meal}`)}</h2>
                <span className="text-xs text-muted">
                  <span className="num">{kcal(mealTotal.calories)}</span> {t("n.kcal")}
                </span>
              </div>
              {items.length ? (
                <ul className="mt-2">
                  {items.map((item) => (
                    <li key={item.id} className="flex items-center gap-2 border-b border-line py-2 last:border-b-0">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{item.name}</p>
                        <p className="text-xs text-muted">
                          {item.grams != null && (
                            <>
                              <span className="num">{grams(item.grams)}</span> {t("n.g")} ·{" "}
                            </>
                          )}
                          {t("n.protein")} <span className="num">{grams(item.protein_g)}</span> · {t("n.carbs")}{" "}
                          <span className="num">{grams(item.carbs_g)}</span> · {t("n.fat")} <span className="num">{grams(item.fat_g)}</span>
                        </p>
                      </div>
                      <span className="num shrink-0 text-sm">{kcal(item.calories)}</span>
                      <form action={deleteFoodLog}>
                        <input type="hidden" name="id" value={item.id} />
                        <button aria-label={`${t("w.remove")} ${item.name}`} className="h-8 w-8 rounded-md text-muted hover:text-danger">
                          ×
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-muted">{t("n.nothingLogged")}</p>
              )}
              <Link
                href={`/nutrition/add?meal=${meal}${date === today ? "" : `&date=${date}`}`}
                className={`${ghostButtonClass} mt-2 flex w-full items-center justify-center`}
              >
                + {t("n.add")}
              </Link>
            </Card>
          );
        })}
      </div>
    </>
  );
}
