import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { todayISO } from "@/lib/dates";
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
  const [{ data: live }, target, { data: logRows }] = await Promise.all([
    supabase.from("workouts").select("id").eq("user_id", profile.id).is("ended_at", null).limit(1).maybeSingle(),
    targetOn(supabase, profile.id, today),
    supabase
      .from("food_logs")
      .select("id, meal, name, grams, food_id, meal_option_id, calories, protein_g, carbs_g, fat_g, fiber_g")
      .eq("user_id", profile.id)
      .eq("log_date", today),
  ]);
  const totals = sum(((logRows ?? []) as LogRow[]).map(normalizeLog));

  return (
    <>
      <PageTitle>
        {t("today.greeting")}
        {profile.full_name ? `${locale === "ar" ? "،" : ","} ${profile.full_name}` : ""}
      </PageTitle>
      {/* Filled in as each feature group lands: check-in (3), feedback (4) */}
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
          <p className="mt-1 text-sm text-muted">{t("common.soon")} 3.</p>
        </Card>
      </div>
    </>
  );
}
