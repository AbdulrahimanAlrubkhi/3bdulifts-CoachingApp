import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { DAILY_COLUMNS, normalizeDaily, type DailyCheckin } from "@/lib/checkins";
import { loadClientMetrics } from "@/lib/coach-data";
import { weightSeries } from "@/lib/coach-metrics";
import { CLIENT_COLUMNS, ageOn, type ClientRow } from "@/lib/clients";
import { formatDay, todayISO } from "@/lib/dates";
import { getT } from "@/lib/i18n";
import type { TKey } from "@/lib/i18n/dictionaries";
import { kcal, targetOn } from "@/lib/nutrition";
import { createClient } from "@/lib/supabase/server";
import { fmt, fmtWeight, toDisplay } from "@/lib/units";
import { analyse, fetchSetStats } from "@/lib/workout-stats";
import { WeightChart } from "@/components/CoachCharts";
import { Logo } from "@/components/Logo";
import { PrefsSync } from "@/components/Prefs";
import { PrintButton } from "@/components/PrintButton";
import Loading from "../../loading";

// Printable progress report (spec #21 — PDF). Opened from the client page; the browser's
// print dialog saves it as a PDF, which keeps Arabic text shaped correctly.
export default function ReportPage({ params }: PageProps<"/report/[id]">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-6 print:max-w-none print:px-0 print:py-0">
      <PrefsSync />
      <Suspense fallback={<Loading />}>
        <Report params={params} />
      </Suspense>
    </main>
  );
}

async function Report({ params }: { params: PageProps<"/report/[id]">["params"] }) {
  const { id } = await params;
  const coach = await getProfile();
  if (!coach) redirect("/login");
  if (coach.role !== "coach") redirect("/today");
  const { t, locale } = await getT();
  const supabase = await createClient();
  const today = todayISO();

  const [{ data: profile }, { data: clientRow }, { data: dailyRows }, { data: weekly }, target, stats, { metrics }] = await Promise.all([
    supabase.from("profiles").select("full_name, role").eq("id", id).maybeSingle(),
    supabase.from("clients").select(CLIENT_COLUMNS).eq("user_id", id).maybeSingle(),
    supabase.from("daily_checkins").select(DAILY_COLUMNS).eq("user_id", id).order("check_date"),
    supabase.from("weekly_checkins").select("week_start, waist_cm, chest_cm, hip_cm, arm_cm, reflections").eq("user_id", id).order("week_start", { ascending: false }).limit(8),
    targetOn(supabase, id, today),
    fetchSetStats(supabase, id),
    loadClientMetrics(supabase, id),
  ]);
  if (!profile || profile.role !== "client" || !clientRow) notFound();
  const client = clientRow as ClientRow;
  const daily = ((dailyRows ?? []) as DailyCheckin[]).map(normalizeDaily);
  const series = weightSeries(daily.filter((d) => d.weight_kg != null).map((d) => ({ date: d.check_date, kg: d.weight_kg! })));
  const m = metrics.get(id)!;
  const { workouts, records } = analyse(stats);
  const unit = coach.unit;
  const start = client.starting_weight_kg != null ? Number(client.starting_weight_kg) : series[0]?.kg ?? null;
  const now = series.at(-1)?.avg ?? null;
  const day = (d: string) => formatDay(d, locale, { day: "numeric", month: "short", year: "numeric" });

  const fact = (label: string, value: React.ReactNode) => (
    <div className="rounded-md border border-line p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-lg font-semibold">{value}</dd>
    </div>
  );

  return (
    <article className="space-y-6 text-[14px]">
      <header className="flex items-start justify-between gap-4 border-b border-line pb-4">
        <div>
          <Logo />
          <h1 className="mt-3 text-2xl font-semibold">{t("ex.reportTitle")}</h1>
          <p className="mt-1 text-muted">
            {profile.full_name}
            {client.birth_date && ` · ${t("cc.age")} ${ageOn(client.birth_date, today)}`}
            {client.goal && ` · ${t(`goal.${client.goal}` as TKey)}`}
          </p>
          <p className="text-xs text-muted">
            {t("ex.generated")} {day(today)}
            {client.start_date && ` · ${t("cc.startDate")} ${day(client.start_date)}`}
          </p>
        </div>
        <PrintButton label={t("ex.print")} />
      </header>

      <section>
        <h2 className="mb-2 font-semibold">{t("ex.summary")}</h2>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 print:grid-cols-4">
          {fact(t("cc.startWeight"), <span className="num">{fmtWeight(start, unit)}</span>)}
          {fact(t("cc.avg7"), <span className="num">{fmtWeight(now, unit)}</span>)}
          {fact(
            t("win.weight"),
            <span className="num">
              {start != null && now != null ? `${now - start > 0 ? "+" : "−"}${fmt(Math.abs(toDisplay(now - start, unit)!))} ${unit}` : "–"}
            </span>,
          )}
          {fact(t("cc.workouts"), <span className="num">{m.workoutPct == null ? "–" : `${m.workoutPct}%`}</span>)}
          {fact(t("cc.nutrition"), <span className="num">{m.nutritionPct == null ? "–" : `${m.nutritionPct}%`}</span>)}
          {fact(t("w.history"), <span className="num">{workouts.size}</span>)}
          {fact(t("w.records"), <span className="num">{records.size}</span>)}
          {fact(
            t("n.target"),
            target ? (
              <span className="text-base">
                {t(`phase.${target.phase}`)} · <span className="num">{kcal(target.calories)}</span>
              </span>
            ) : (
              "–"
            ),
          )}
        </dl>
      </section>

      {series.length >= 2 && (
        <section className="break-inside-avoid">
          <h2 className="mb-2 font-semibold">{t("cc.weightTrend")}</h2>
          <WeightChart
            points={series.map((p) => ({ label: formatDay(p.date, "en", { day: "numeric", month: "short" }), kg: toDisplay(p.kg, unit)!, avg: toDisplay(p.avg, unit)! }))}
            unit={unit}
            dailyLabel={t("cc.daily")}
            avgLabel={t("cc.avgLine")}
          />
        </section>
      )}

      {(weekly ?? []).length > 0 && (
        <section className="break-inside-avoid">
          <h2 className="mb-2 font-semibold">
            {t("cc.measurements")} · {t("ex.weekly8")}
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="py-1 text-start font-normal">{t("c.weekOf")}</th>
                {(["waist_cm", "chest_cm", "hip_cm", "arm_cm"] as const).map((k) => (
                  <th key={k} className="py-1 text-end font-normal">
                    {t(`c.${k}`)}
                  </th>
                ))}
                <th className="py-1 text-end font-normal">{t("ex.rating")}</th>
              </tr>
            </thead>
            <tbody>
              {(weekly ?? []).map((w) => (
                <tr key={w.week_start} className="border-t border-line">
                  <td className="py-1.5">{day(w.week_start)}</td>
                  {(["waist_cm", "chest_cm", "hip_cm", "arm_cm"] as const).map((k) => (
                    <td key={k} className="num py-1.5 text-end">
                      {w[k] == null ? "–" : Number(w[k])}
                    </td>
                  ))}
                  <td className="num py-1.5 text-end">{(w.reflections as Record<string, number> | null)?.rating ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {client.injuries && (
        <section>
          <h2 className="mb-1 font-semibold">{t("ob.injuries")}</h2>
          <p className="whitespace-pre-wrap text-muted">{client.injuries}</p>
        </section>
      )}
    </article>
  );
}
