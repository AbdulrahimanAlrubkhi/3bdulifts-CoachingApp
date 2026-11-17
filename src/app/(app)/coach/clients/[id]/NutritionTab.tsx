import Link from "next/link";
import { nutritionStatus } from "@/lib/checkins";
import { targetFor } from "@/lib/coach-metrics";
import { addDays, todayISO } from "@/lib/dates";
import { TARGET_COLUMNS, type Target } from "@/lib/nutrition";
import { createClient } from "@/lib/supabase/server";
import { TargetBars } from "@/components/CoachCharts";
import { Card } from "@/components/ui";
import type { TabProps } from "./tab-props";

// Macros vs target over two weeks (spec #16), as four small charts rather than one crowded one.
export async function NutritionTab({ clientId, t }: TabProps) {
  const supabase = await createClient();
  const today = todayISO();
  const from = addDays(today, -13);
  const [{ data: rows }, { data: targetRows }] = await Promise.all([
    supabase
      .from("v_daily_nutrition")
      .select("log_date, calories, protein_g, carbs_g, fat_g, fiber_g")
      .eq("user_id", clientId)
      .gte("log_date", from)
      .lte("log_date", today),
    supabase.from("nutrition_targets").select(TARGET_COLUMNS).eq("client_id", clientId),
  ]);
  const targets = (targetRows ?? []) as Target[];
  const current = targetFor(targets, today);
  const byDay = new Map((rows ?? []).map((r) => [r.log_date as string, r]));
  const days = Array.from({ length: 14 }, (_, i) => addDays(from, i));
  const series = (key: "calories" | "protein_g" | "carbs_g" | "fat_g") =>
    days.map((d) => ({ label: String(Number(d.slice(8))), value: byDay.has(d) ? Math.round(Number(byDay.get(d)![key])) : null }));

  // full days only: today is still being logged
  const judged = days.filter((d) => d < today && targetFor(targets, d));
  const onTarget = judged.filter((d) => {
    const r = byDay.get(d);
    const totals = { calories: Number(r?.calories ?? 0), protein_g: Number(r?.protein_g ?? 0), carbs_g: 0, fat_g: 0, fiber_g: 0 };
    return nutritionStatus(totals, targetFor(targets, d), Boolean(r)).status === "on";
  }).length;

  const charts: [string, "calories" | "protein_g" | "carbs_g" | "fat_g", number | null, string][] = [
    [t("n.calories"), "calories", current?.calories ?? null, t("n.kcal")],
    [t("n.protein"), "protein_g", current?.protein_g ?? null, t("n.g")],
    [t("n.carbs"), "carbs_g", current?.carbs_g ?? null, t("n.g")],
    [t("n.fat"), "fat_g", current?.fat_g ?? null, t("n.g")],
  ];

  return (
    <div className="space-y-3">
      <Card>
        <p className="mb-3 text-sm">
          {t("cc.last14")} ·{" "}
          {judged.length ? (
            <>
              <span className="num">{`${onTarget}/${judged.length}`}</span> {t("cc.daysOnTarget")}
            </>
          ) : (
            <span className="text-muted">{t("n.noTarget")}</span>
          )}
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          {charts.map(([title, key, target, unit]) => (
            <TargetBars key={key} title={title} points={series(key)} target={target} unit={unit} targetLabel={t("n.target")} />
          ))}
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <Link href={`/coach/clients/${clientId}/targets`}>
          <Card className="p-3 font-medium">{t("n.targets")}</Card>
        </Link>
        <Link href={`/coach/library/meal-plans?client=${clientId}`}>
          <Card className="p-3 font-medium">{t("n.plans")}</Card>
        </Link>
      </div>
    </div>
  );
}
