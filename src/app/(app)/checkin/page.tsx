import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { DAILY_COLUMNS, nutritionStatus, normalizeDaily, type DailyCheckin } from "@/lib/checkins";
import { addDays, dateParam, dayBounds, formatDay, todayISO, weekStartOf } from "@/lib/dates";
import { getT } from "@/lib/i18n";
import { kcal, normalizeLog, sum, targetOn, type LogRow } from "@/lib/nutrition";
import { createClient } from "@/lib/supabase/server";
import { fmt, fmtWeight, toDisplay } from "@/lib/units";
import { ScaleInput } from "@/components/ScaleInput";
import { Card, Field, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { saveDailyCheckin } from "./actions";

export default async function CheckinPage({ searchParams }: PageProps<"/checkin">) {
  const params = await searchParams;
  const profile = await requireProfile();
  const { t, locale } = await getT();
  const today = todayISO();
  const date = dateParam(params.date) > today ? today : dateParam(params.date);
  const [from, to] = dayBounds(date);
  const supabase = await createClient();

  const [{ data: row }, { data: recentRows }, { data: workouts }, { data: logRows }, target, { data: weekly }] = await Promise.all([
    supabase.from("daily_checkins").select(DAILY_COLUMNS).eq("user_id", profile.id).eq("check_date", date).maybeSingle(),
    supabase.from("daily_checkins").select(DAILY_COLUMNS).eq("user_id", profile.id).order("check_date", { ascending: false }).limit(7),
    // "training done" = any finished workout that started on this day
    supabase
      .from("workouts")
      .select("id, title")
      .eq("user_id", profile.id)
      .not("ended_at", "is", null)
      .gte("started_at", from)
      .lt("started_at", to),
    supabase
      .from("food_logs")
      .select("id, meal, name, grams, food_id, meal_option_id, calories, protein_g, carbs_g, fat_g, fiber_g")
      .eq("user_id", profile.id)
      .eq("log_date", date),
    targetOn(supabase, profile.id, date),
    supabase.from("weekly_checkins").select("id").eq("user_id", profile.id).eq("week_start", weekStartOf(today)).maybeSingle(),
  ]);
  const checkin = row ? normalizeDaily(row as DailyCheckin) : null;
  const logs = ((logRows ?? []) as LogRow[]).map(normalizeLog);
  const totals = sum(logs);
  const nutrition = nutritionStatus(totals, target, logs.length > 0);
  const recent = ((recentRows ?? []) as DailyCheckin[]).map(normalizeDaily);
  const q = (d: string) => (d === today ? "/checkin" : `/checkin?date=${d}`);
  const arrow = "flex h-9 w-9 items-center justify-center rounded-md border border-line text-muted hover:text-text";
  const statusText = { on: t("c.onTarget"), under: t("c.under"), over: t("c.over"), none: "" }[nutrition.status];

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link href={q(addDays(date, -1))} aria-label={t("n.prevDay")} className={arrow}>
          <span className="inline-block rtl:rotate-180">‹</span>
        </Link>
        <div className="text-center">
          <PageTitle>{t("c.daily")}</PageTitle>
          <p className="-mt-3 text-sm text-muted">
            {date === today ? t("n.today") : formatDay(date, locale, { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        {date < today ? (
          <Link href={q(addDays(date, 1))} aria-label={t("n.nextDay")} className={arrow}>
            <span className="inline-block rtl:rotate-180">›</span>
          </Link>
        ) : (
          <span className="h-9 w-9" />
        )}
      </div>

      {!weekly && (
        <Link href="/checkin/weekly" className="mb-3 block">
          <Card className="border-accent text-sm">
            <span className="text-accent">{t("c.weeklyDue")}</span> <span className="inline-block rtl:rotate-180">→</span>
          </Card>
        </Link>
      )}

      {params.saved && <p className="mb-3 text-sm text-accent" role="status">✓ {t("c.saved")}</p>}
      {params.error && <p className="mb-3 text-sm text-danger" role="alert">{t("w.saveFailed")}</p>}

      {/* the two parts the client doesn't type: read from the workout and food logs */}
      <Card className="mb-3 space-y-3">
        <p className="text-xs text-muted">{t("c.auto")}</p>
        <div className="flex items-start justify-between gap-3">
          <span className="text-sm">{t("c.training")}</span>
          <span className="text-end text-sm">
            {workouts?.length ? (
              workouts.map((w) => (
                <Link key={w.id} href={`/workouts/history/${w.id}`} className="block text-accent underline underline-offset-4">
                  ✓ {w.title}
                </Link>
              ))
            ) : (
              <span className="text-muted">{t("c.restDay")}</span>
            )}
          </span>
        </div>
        <div className="flex items-start justify-between gap-3 border-t border-line pt-3">
          <span className="text-sm">{t("c.nutrition")}</span>
          <span className="text-end text-sm">
            {!logs.length ? (
              <span className="text-muted">{t("c.noFood")}</span>
            ) : (
              <>
                <span className={nutrition.status === "on" ? "text-accent" : ""}>
                  {statusText}
                  {date === today && nutrition.status !== "on" && <span className="text-muted"> ({t("c.soFar")})</span>}
                </span>
                <span className="block text-xs text-muted">
                  <span className="num">{kcal(totals.calories)}</span>
                  {target && (
                    <>
                      {" "}
                      / <span className="num">{kcal(target.calories)}</span>
                    </>
                  )}{" "}
                  {t("n.kcal")} · {t("n.protein")} <span className="num">{Math.round(totals.protein_g)}</span>
                  {target && (
                    <>
                      {" "}
                      / <span className="num">{target.protein_g}</span>
                    </>
                  )}
                  {t("n.g")}
                </span>
              </>
            )}
          </span>
        </div>
      </Card>

      <Card className="mb-5">
        {/* keyed by the saved values so the fields show what's stored after each save */}
        <form key={JSON.stringify(checkin)} action={saveDailyCheckin} className="space-y-4">
          <input type="hidden" name="date" value={date} />
          <div className="grid grid-cols-3 gap-3">
            <Field label={`${t("c.weight")} (${profile.unit})`}>
              <input
                name="weight"
                inputMode="decimal"
                defaultValue={checkin?.weight_kg == null ? "" : fmt(toDisplay(checkin.weight_kg, profile.unit))}
                className={`${inputClass} num text-center`}
              />
            </Field>
            <Field label={t("c.steps")}>
              <input name="steps" inputMode="numeric" defaultValue={checkin?.steps ?? ""} className={`${inputClass} num text-center`} />
            </Field>
            <Field label={t("c.sleep")}>
              <input name="sleep_hours" inputMode="decimal" defaultValue={checkin?.sleep_hours ?? ""} className={`${inputClass} num text-center`} />
            </Field>
          </div>
          <ScaleInput name="energy" label={t("c.energy")} value={checkin?.energy ?? null} low={t("c.low")} high={t("c.high")} />
          <ScaleInput name="hunger" label={t("c.hunger")} value={checkin?.hunger ?? null} low={t("c.low")} high={t("c.high")} />
          <ScaleInput name="stress" label={t("c.stress")} value={checkin?.stress ?? null} low={t("c.low")} high={t("c.high")} />
          <Field label={t("c.notes")}>
            <textarea name="notes" rows={3} defaultValue={checkin?.notes ?? ""} placeholder={t("c.notesHint")} className={`${inputClass} h-auto py-2`} />
          </Field>
          <button className={buttonClass}>{t("c.save")}</button>
        </form>
      </Card>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm text-muted">{t("c.recent")}</h2>
          <Link href="/checkin/weekly" className="text-sm text-accent underline underline-offset-4">
            {t("c.weekly")}
          </Link>
        </div>
        {!recent.length ? (
          <Card>
            <p className="text-sm text-muted">{t("c.noRecent")}</p>
          </Card>
        ) : (
          <Card className="py-1">
            <ul>
              {recent.map((r) => (
                <li key={r.check_date}>
                  <Link href={q(r.check_date)} className="flex items-center justify-between gap-3 border-b border-line py-2.5 text-sm last:border-b-0">
                    <span>{formatDay(r.check_date, locale, { weekday: "short", day: "numeric", month: "short" })}</span>
                    <span className="flex gap-3 text-xs text-muted">
                      <span className="num text-text">{fmtWeight(r.weight_kg, profile.unit)}</span>
                      {r.steps != null && <span className="num">{r.steps.toLocaleString("en-US")}</span>}
                      {r.sleep_hours != null && (
                        <span>
                          <span className="num">{r.sleep_hours}</span>
                          {t("c.h")}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </>
  );
}
