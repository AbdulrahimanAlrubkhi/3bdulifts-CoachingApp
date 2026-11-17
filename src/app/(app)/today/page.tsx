import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { todayISO, weekStartOf } from "@/lib/dates";
import { fmtWeight } from "@/lib/units";
import { normalizeLog, sum, targetOn, type LogRow } from "@/lib/nutrition";
import { createClient } from "@/lib/supabase/server";
import { MacroBars } from "@/components/MacroBars";
import { PlanStatus } from "@/components/PlanStatus";
import { Card, PageTitle } from "@/components/ui";

export default async function TodayPage() {
  const profile = await requireProfile();
  if (profile.role === "coach") redirect("/coach");
  const { t, locale } = await getT();
  const supabase = await createClient();
  const today = todayISO();
  const [{ data: live }, target, { data: logRows }, { data: checkin }, { data: weekly }, { data: feedback }] = await Promise.all([
    supabase.from("workouts").select("id").eq("user_id", profile.id).is("ended_at", null).limit(1).maybeSingle(),
    targetOn(supabase, profile.id, today),
    supabase
      .from("food_logs")
      .select("id, meal, name, grams, food_id, meal_option_id, calories, protein_g, carbs_g, fat_g, fiber_g")
      .eq("user_id", profile.id)
      .eq("log_date", today),
    supabase.from("daily_checkins").select("weight_kg").eq("user_id", profile.id).eq("check_date", today).maybeSingle(),
    supabase.from("weekly_checkins").select("id").eq("user_id", profile.id).eq("week_start", weekStartOf(today)).maybeSingle(),
    supabase
      .from("weekly_feedback")
      .select("week_start, body, read_at")
      .eq("client_id", profile.id)
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const totals = sum(((logRows ?? []) as LogRow[]).map(normalizeLog));

  return (
    <>
      <PageTitle>
        {t("today.greeting")}
        {profile.full_name ? `${locale === "ar" ? "،" : ","} ${profile.full_name}` : ""}
      </PageTitle>
      <div className="space-y-3">
        {/* renewal reminder: only appears when the plan is ending, ended or unpaid */}
        <PlanStatus supabase={supabase} clientId={profile.id} t={t} locale={locale} onlyWhenDue />
        {feedback && (
          // the latest note from the coach comes first; the full text is one tap away
          <Link href="/more/feedback" className="block">
            <Card className={feedback.read_at ? "" : "border-accent"}>
              <h2 className="flex items-center justify-between text-sm font-medium">
                {t("fb.title")}
                {!feedback.read_at && <span className="text-xs font-normal text-accent">{t("fb.new")}</span>}
              </h2>
              <p className="mt-1 line-clamp-3 text-sm whitespace-pre-wrap text-muted">{feedback.body}</p>
            </Card>
          </Link>
        )}
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
