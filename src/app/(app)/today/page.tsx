import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { Card, PageTitle } from "@/components/ui";

export default async function TodayPage() {
  const profile = await requireProfile();
  if (profile.role === "coach") redirect("/coach");
  const { t, locale } = await getT();
  const supabase = await createClient();
  const { data: live } = await supabase
    .from("workouts")
    .select("id")
    .eq("user_id", profile.id)
    .is("ended_at", null)
    .limit(1)
    .maybeSingle();

  return (
    <>
      <PageTitle>
        {t("today.greeting")}
        {profile.full_name ? `${locale === "ar" ? "،" : ","} ${profile.full_name}` : ""}
      </PageTitle>
      {/* Filled in as each feature group lands: workout (1), macros (2), check-in (3), feedback (4) */}
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
        <Card>
          <h2 className="text-sm font-medium">{t("nav.nutrition")}</h2>
          <p className="mt-1 text-sm text-muted">{t("common.soon")} 2.</p>
        </Card>
        <Card>
          <h2 className="text-sm font-medium">{t("nav.checkin")}</h2>
          <p className="mt-1 text-sm text-muted">{t("common.soon")} 3.</p>
        </Card>
      </div>
    </>
  );
}
