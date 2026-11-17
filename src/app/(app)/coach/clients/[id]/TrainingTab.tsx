import Link from "next/link";
import { formatDay, dateInAppTz } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { fmtWeight } from "@/lib/units";
import { analyse, fetchSetStats } from "@/lib/workout-stats";
import { Card } from "@/components/ui";
import type { TabProps } from "./tab-props";

export async function TrainingTab({ clientId, t, locale, unit }: TabProps) {
  const supabase = await createClient();
  const [{ data: workouts }, stats, { data: assigned }] = await Promise.all([
    supabase
      .from("workouts")
      .select("id, title, started_at, ended_at")
      .eq("user_id", clientId)
      .not("ended_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(40),
    fetchSetStats(supabase, clientId),
    supabase.from("routine_assignments").select("routines(id, title)").eq("client_id", clientId),
  ]);
  const { workouts: summaries, records } = analyse(stats);
  const routines = (assigned ?? []).map((a) => a.routines as unknown as { id: string; title: string } | null).filter(Boolean);

  return (
    <div className="space-y-4">
      <section>
        <h2 className="mb-2 text-sm text-muted">{t("w.assigned")}</h2>
        <Card className="py-1">
          {routines.length ? (
            <ul>
              {routines.map((r) => (
                <li key={r!.id}>
                  <Link href={`/workouts/routines/${r!.id}`} className="block border-b border-line py-2.5 text-sm last:border-b-0">
                    {r!.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-2 text-sm text-muted">{t("w.noRoutines")}</p>
          )}
        </Card>
      </section>

      <section>
        <h2 className="mb-2 text-sm text-muted">
          {t("cc.workoutHistory")} · <span className="num">{records.size}</span> {t("w.records")}
        </h2>
        {!workouts?.length ? (
          <Card>
            <p className="text-sm text-muted">{t("w.noHistory")}</p>
          </Card>
        ) : (
          <Card className="py-1">
            <ul>
              {workouts.map((w) => {
                const s = summaries.get(w.id);
                const minutes = Math.round((Date.parse(w.ended_at) - Date.parse(w.started_at)) / 60000);
                return (
                  <li key={w.id}>
                    <Link href={`/workouts/history/${w.id}`} className="flex items-center justify-between gap-3 border-b border-line py-2.5 text-sm last:border-b-0">
                      <span className="min-w-0">
                        <span className="block truncate">{w.title}</span>
                        <span className="text-xs text-muted">{formatDay(dateInAppTz(w.started_at), locale, { weekday: "short", day: "numeric", month: "short" })}</span>
                      </span>
                      <span className="shrink-0 text-end text-xs text-muted">
                        <span className="num text-text">{fmtWeight(s?.volume_kg ?? 0, unit)}</span>
                        <span className="block">
                          <span className="num">{minutes}</span> {t("w.min")}
                          {s && s.prSetIds.size > 0 && (
                            <span className="text-accent">
                              {" "}
                              · <span className="num">{s.prSetIds.size}</span> {t("w.pr")}
                            </span>
                          )}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
