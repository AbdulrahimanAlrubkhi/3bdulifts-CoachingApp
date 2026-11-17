import { Fragment } from "react";
import { DAILY_COLUMNS, MEASUREMENTS, REFLECTIONS, normalizeDaily, type DailyCheckin } from "@/lib/checkins";
import { weightSeries } from "@/lib/coach-metrics";
import { addDays, formatDay, todayISO } from "@/lib/dates";
import type { TKey } from "@/lib/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import { fmtWeight, toDisplay } from "@/lib/units";
import { MiniLine, WeightChart } from "@/components/CoachCharts";
import { Card } from "@/components/ui";
import type { TabProps } from "./tab-props";

type Weekly = {
  week_start: string;
  waist_cm: number | null;
  chest_cm: number | null;
  hip_cm: number | null;
  arm_cm: number | null;
  reflections: Record<string, string | number> | null;
};

// Weight trend, measurements over time, daily check-ins and weekly reflections (spec #16).
export async function CheckinsTab({ clientId, t, locale, unit }: TabProps) {
  const supabase = await createClient();
  const today = todayISO();
  const [{ data: dailyRows }, { data: weeklyRows }] = await Promise.all([
    supabase.from("daily_checkins").select(DAILY_COLUMNS).eq("user_id", clientId).gte("check_date", addDays(today, -89)).order("check_date"),
    supabase
      .from("weekly_checkins")
      .select("week_start, waist_cm, chest_cm, hip_cm, arm_cm, reflections")
      .eq("user_id", clientId)
      .order("week_start"),
  ]);
  const daily = ((dailyRows ?? []) as DailyCheckin[]).map(normalizeDaily);
  const weekly = (weeklyRows ?? []) as Weekly[];

  const series = weightSeries(daily.filter((d) => d.weight_kg != null).map((d) => ({ date: d.check_date, kg: d.weight_kg! })));
  const weightPoints = series.map((p) => ({
    label: formatDay(p.date, "en", { day: "numeric", month: "short" }),
    kg: toDisplay(p.kg, unit)!,
    avg: toDisplay(p.avg, unit)!,
  }));
  const short = { day: "numeric", month: "short" } as const;
  const recent = [...daily].reverse().slice(0, 14);
  const scale = (v: number | null) => (v == null ? "–" : String(v));

  return (
    <div className="space-y-3">
      <Card>
        <h2 className="mb-2 text-sm font-medium">{t("cc.weightTrend")}</h2>
        {weightPoints.length >= 2 ? (
          <WeightChart points={weightPoints} unit={unit} dailyLabel={t("cc.daily")} avgLabel={t("cc.avgLine")} />
        ) : (
          <p className="text-sm text-muted">{t("cc.noData")}</p>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-medium">{t("cc.measurements")}</h2>
        {weekly.some((w) => MEASUREMENTS.some((m) => w[m] != null)) ? (
          <div className="grid grid-cols-2 gap-4">
            {MEASUREMENTS.map((m) => (
              <MiniLine
                key={m}
                title={t(`c.${m}` as TKey)}
                unit="cm"
                points={weekly.map((w) => ({ label: formatDay(w.week_start, "en", short), value: w[m] == null ? null : Number(w[m]) }))}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">{t("cc.noData")}</p>
        )}
      </Card>

      <Card className="overflow-x-auto">
        <h2 className="mb-2 text-sm font-medium">{t("cc.dailyLog")}</h2>
        {!recent.length ? (
          <p className="text-sm text-muted">{t("c.noRecent")}</p>
        ) : (
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-[11px] text-muted">
                <th className="pb-2 text-start font-normal" />
                <th className="pb-2 text-end font-normal">{t("c.weight")}</th>
                <th className="pb-2 text-end font-normal">{t("c.steps")}</th>
                <th className="pb-2 text-end font-normal">{t("c.sleep")}</th>
                <th className="pb-2 text-center font-normal">{t("c.energy")}</th>
                <th className="pb-2 text-center font-normal">{t("c.hunger")}</th>
                <th className="pb-2 text-center font-normal">{t("c.stress")}</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((d) => (
                <Fragment key={d.check_date}>
                  <tr className="border-t border-line">
                    <td className="py-2 whitespace-nowrap">{formatDay(d.check_date, locale, { weekday: "short", ...short })}</td>
                    <td className="num py-2 text-end">{fmtWeight(d.weight_kg, unit)}</td>
                    <td className="num py-2 text-end">{d.steps == null ? "–" : d.steps.toLocaleString("en-US")}</td>
                    <td className="num py-2 text-end">{d.sleep_hours ?? "–"}</td>
                    <td className="num py-2 text-center">{scale(d.energy)}</td>
                    <td className="num py-2 text-center">{scale(d.hunger)}</td>
                    <td className="num py-2 text-center">{scale(d.stress)}</td>
                  </tr>
                  {d.notes && (
                    <tr>
                      <td colSpan={7} className="pb-2 text-xs text-muted">
                        {d.notes}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-medium">{t("cc.weeklyAnswers")}</h2>
        {!weekly.length ? (
          <p className="text-sm text-muted">{t("cc.noData")}</p>
        ) : (
          <ul className="space-y-4">
            {[...weekly].reverse().slice(0, 6).map((w) => (
              <li key={w.week_start} className="border-t border-line pt-3 first:border-t-0 first:pt-0">
                <p className="mb-1 text-xs text-muted">
                  {t("c.weekOf")} {formatDay(w.week_start, locale, short)}
                </p>
                <dl className="space-y-1.5 text-sm">
                  {REFLECTIONS.map((q) =>
                    w.reflections?.[q.key] != null && w.reflections[q.key] !== "" ? (
                      <div key={q.key}>
                        <dt className="text-xs text-muted">{t(`c.q.${q.key}` as TKey)}</dt>
                        <dd className="whitespace-pre-wrap">
                          {q.kind === "score" ? <span className="num">{`${w.reflections[q.key]}/10`}</span> : w.reflections[q.key]}
                        </dd>
                      </div>
                    ) : null,
                  )}
                </dl>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
