import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { addDays, dateParam, formatDay, todayISO } from "@/lib/dates";
import { getT } from "@/lib/i18n";
import { grams, kcal, targetOn, type Macros } from "@/lib/nutrition";
import { createClient } from "@/lib/supabase/server";
import { WeekChart } from "@/components/WeekChart";
import { Card, PageTitle, ghostButtonClass } from "@/components/ui";

// The 7 days ending on the chosen date. Averages count only days with something logged,
// so a forgotten day doesn't drag the numbers down.
export default async function WeekPage({ searchParams }: PageProps<"/nutrition/week">) {
  const profile = await requireProfile();
  const { t, locale } = await getT();
  const end = dateParam((await searchParams).date);
  const start = addDays(end, -6);
  const supabase = await createClient();

  const [{ data: rows }, target] = await Promise.all([
    supabase
      .from("v_daily_nutrition")
      .select("log_date, calories, protein_g, carbs_g, fat_g, fiber_g")
      .eq("user_id", profile.id)
      .gte("log_date", start)
      .lte("log_date", end),
    targetOn(supabase, profile.id, end),
  ]);
  const byDay = new Map((rows ?? []).map((r) => [r.log_date as string, r]));
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const logged = days.filter((d) => byDay.has(d));

  const avg = (key: keyof Macros) =>
    logged.length ? logged.reduce((s, d) => s + Number(byDay.get(d)![key] ?? 0), 0) / logged.length : 0;
  const averages: Macros = { calories: avg("calories"), protein_g: avg("protein_g"), carbs_g: avg("carbs_g"), fat_g: avg("fat_g"), fiber_g: avg("fiber_g") };

  const points = days.map((d) => ({
    label: formatDay(d, "en", { weekday: "short" }),
    calories: byDay.has(d) ? Math.round(Number(byDay.get(d)!.calories)) : null,
  }));

  const rowsOut: [string, number, number | null | undefined, string][] = [
    [t("n.calories"), averages.calories, target?.calories, t("n.kcal")],
    [t("n.protein"), averages.protein_g, target?.protein_g, t("n.g")],
    [t("n.carbs"), averages.carbs_g, target?.carbs_g, t("n.g")],
    [t("n.fat"), averages.fat_g, target?.fat_g, t("n.g")],
    [t("n.fiber"), averages.fiber_g, target?.fiber_g, t("n.g")],
  ];

  return (
    <>
      <PageTitle>{t("n.week")}</PageTitle>
      <p className="-mt-3 mb-4 text-sm text-muted">
        {formatDay(start, locale, { day: "numeric", month: "short" })} – {formatDay(end, locale, { day: "numeric", month: "short" })} ·{" "}
        <span className="num">{logged.length}</span>/<span className="num">7</span> {t("n.daysLogged")}
      </p>

      <Card className="mb-3">
        <WeekChart points={points} target={target?.calories ?? null} title={t("n.perDay")} unit={t("n.kcal")} targetLabel={t("n.target")} />
      </Card>

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted">
              <th className="pb-2 text-start font-normal" />
              <th className="pb-2 text-end font-normal">{t("n.week")}</th>
              <th className="pb-2 text-end font-normal">{t("n.target")}</th>
            </tr>
          </thead>
          <tbody>
            {rowsOut.map(([label, value, goal, unit], i) => (
              <tr key={label} className="border-t border-line">
                <td className="py-2">{label}</td>
                <td className="num py-2 text-end">
                  {logged.length ? (i === 0 ? kcal(value) : grams(Math.round(value))) : "–"} <span className="text-xs text-muted">{unit}</span>
                </td>
                <td className="num py-2 text-end text-muted">{goal != null ? (i === 0 ? kcal(goal) : goal) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">{t("n.avgOfLogged")}</p>
      </Card>

      <Link href={end === todayISO() ? "/nutrition" : `/nutrition?date=${end}`} className={`${ghostButtonClass} mt-6 flex w-full items-center justify-center`}>
        {t("nav.nutrition")}
      </Link>
    </>
  );
}
