import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { todayISO, weekStartOf } from "@/lib/dates";
import { fmtWeight } from "@/lib/units";
import { normalizeLog, sum, targetOn, type LogRow } from "@/lib/nutrition";
import { createClient } from "@/lib/supabase/server";
import { MacroBars } from "@/components/MacroBars";
import { Card, PageTitle } from "@/components/ui";

export default async function TodayPage() {
  const profile = await requireProfile();
  if (profile.role === "coach") redirect("/coach");
  const { t, locale } = await getT();
  const supabase = await createClient();
  const today = todayISO();
  const [{ data: live }, target, { data: logRows }, { data: checkin }, { data: weekly }] = await Promise.all([
    supabase.from("workouts").select("id").eq("user_id", profile.id).is("ended_at", null).limit(1).maybeSingle(),
    targetOn(supabase, profile.id, today),
    supabase
      .from("food_logs")
      .select("id, meal, name, grams, food_id, meal_option_id, calories, protein_g, carbs_g, fat_g, fiber_g")
      .eq("user_id", profile.id)
      .eq("log_date", today),
    supabase.from("daily_checkins").select("weight_kg").eq("user_id", profile.id).eq("check_date", today).maybeSingle(),
    supabase.from("weekly_checkins").select("id").eq("user_id", profile.id).eq("week_start", weekStartOf(today)).maybeSingle(),
  ]);
  const totals = sum(((logRows ?? []) as LogRow[]).map(normalizeLog));

  return (
    <>
      <PageTitle>
        {t("today.greeting")}
        {profile.full_name ? `${locale === "ar" ? "،" : ","} ${profile.full_name}` : ""}
      </PageTitle>
      {/* coach feedback joins this page in step 4 */}
      <div className="space-y-3">
        <Card>
          <h2 className="text-sm font-medium">{t("nav.workouts")}</h2>
          <Link
            href={live ? `/workouts/live/${live.id}` : "/workouts"}
            className="mt-1 inline-block text-sm text-accent underline underline-offset-4"
          >
            {live ? t("w.resume") : t("w.open")}
          </Link>
        </Card>
        <Link href="/nutrition" className="block">
          <Card>
            <h2 className="mb-3 text-sm font-medium">{t("nav.nutrition")}</h2>
            {!target && <p className="mb-3 text-sm text-muted">{t("n.noTarget")}</p>}
            <MacroBars totals={totals} target={target} t={t} />
          </Card>
        </Link>
        <Card>
          <h2 className="text-sm font-medium">{t("nav.checkin")}</h2>
          {checkin ? (
            <p className="mt-1 text-sm">
              <span className="text-accent">✓ {t("c.done")}</span>
              {checkin.weight_kg != null && (
                <span className="text-muted">
                  {" "}
                  · <span className="num">{fmtWeight(Number(checkin.weight_kg), profile.unit)}</span>
                </span>
              )}
            </p>
          ) : (
            <Link href="/checkin" className="mt-1 inline-block text-sm text-accent underline underline-offset-4">
              {t("c.checkIn")}
            </Link>
          )}
          {!weekly && (
            <Link href="/checkin/weekly" className="mt-2 block text-sm text-muted underline underline-offset-4">
              {t("c.weeklyDue")}
            </Link>
          )}
        </Card>
      </div>
    </>
  );
}
