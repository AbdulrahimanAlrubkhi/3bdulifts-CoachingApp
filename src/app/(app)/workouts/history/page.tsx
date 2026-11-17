import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { fmtWeight } from "@/lib/units";
import { analyse, fetchSetStats } from "@/lib/workout-stats";
import { Card, PageTitle } from "@/components/ui";

export default async function HistoryPage() {
  const profile = await requireProfile();
  const { t, locale } = await getT();
  const supabase = await createClient();

  const [{ data: workouts }, stats] = await Promise.all([
    supabase
      .from("workouts")
      .select("id, title, started_at, ended_at")
      .eq("user_id", profile.id)
      .not("ended_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(100),
    fetchSetStats(supabase, profile.id),
  ]);
  const summaries = analyse(stats).workouts;
  const dateFormat = new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <>
      <PageTitle>{t("w.history")}</PageTitle>
      {!workouts?.length ? (
        <Card>
          <p className="text-sm text-muted">{t("w.noHistory")}</p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {workouts.map((workout) => {
            const summary = summaries.get(workout.id);
            const minutes = Math.round(
              (new Date(workout.ended_at).getTime() - new Date(workout.started_at).getTime()) / 60000,
            );
            return (
              <li key={workout.id}>
                <Link href={`/workouts/history/${workout.id}`}>
                  <Card>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[15px] font-medium">{workout.title}</span>
                      <span className="shrink-0 text-xs text-muted">{dateFormat.format(new Date(workout.started_at))}</span>
                    </div>
                    <dl className="mt-2 flex gap-5 text-xs text-muted">
                      <div>
                        <dt className="inline">{t("w.duration")} </dt>
                        <dd className="inline text-text">
                          <span className="num">{minutes}</span> {t("w.min")}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline">{t("w.volume")} </dt>
                        <dd className="num inline text-text">{fmtWeight(summary?.volume_kg ?? 0, profile.unit)}</dd>
                      </div>
                      {summary && summary.prSetIds.size > 0 && (
                        <div>
                          <dt className="inline">{t("w.prs")} </dt>
                          <dd className="num inline text-accent">{summary.prSetIds.size}</dd>
                        </div>
                      )}
                    </dl>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
