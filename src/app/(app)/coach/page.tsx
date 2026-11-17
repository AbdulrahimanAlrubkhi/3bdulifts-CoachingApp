import Link from "next/link";
import { requireCoach } from "@/lib/auth";
import { loadClientMetrics } from "@/lib/coach-data";
import type { ClientMetrics } from "@/lib/coach-metrics";
import { getT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { FlagChip, NutritionPct, Pct, WeightAndTrend, lastCheckinText } from "@/components/MetricBits";
import { Card, PageTitle } from "@/components/ui";

// Coach dashboard (spec #15): every client at a glance, clients with flags first.
export default async function CoachDashboard() {
  const profile = await requireCoach();
  const { t } = await getT();
  const supabase = await createClient();
  const { clients, metrics } = await loadClientMetrics(supabase);

  const flagged = clients.filter((c) => c.onboarded && metrics.get(c.id)!.flags.length);
  const rest = clients.filter((c) => !flagged.includes(c));

  const row = (c: (typeof clients)[number]) => {
    const m = metrics.get(c.id) as ClientMetrics;
    return (
      <li key={c.id}>
        <Link href={`/coach/clients/${c.id}`}>
          <Card className="p-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[15px] font-medium">{c.full_name || "—"}</span>
              <span className="shrink-0 text-xs text-muted">
                {t("cc.lastCheckin")}: <span className={m.flags.includes("missed") ? "text-danger" : "text-text"}>{lastCheckinText(m, t)}</span>
              </span>
            </div>
            {!c.onboarded ? (
              <p className="mt-2 text-xs text-muted">{t("cc.notOnboarded")}</p>
            ) : (
              <>
                {m.flags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.flags.map((f) => (
                      <FlagChip key={f} flag={f} t={t} />
                    ))}
                  </div>
                )}
                <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-[11px] text-muted">{t("cc.avg7")}</dt>
                    <dd>
                      <WeightAndTrend m={m} unit={profile.unit} t={t} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted">{t("cc.workouts")}</dt>
                    <dd className={m.flags.includes("lowWorkout") ? "text-danger" : ""}>
                      <Pct value={m.workoutPct} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted">{t("cc.nutrition")}</dt>
                    <dd className={m.flags.includes("lowNutrition") ? "text-danger" : ""}>
                      <NutritionPct m={m} t={t} />
                    </dd>
                  </div>
                </dl>
              </>
            )}
          </Card>
        </Link>
      </li>
    );
  };

  return (
    <>
      <PageTitle>{t("coach.clients")}</PageTitle>
      {!clients.length ? (
        <Card>
          <p className="text-sm text-muted">{t("coach.noClients")}</p>
        </Card>
      ) : (
        <div className="space-y-5">
          {flagged.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm text-muted">
                {t("cc.needsAttention")} · <span className="num">{flagged.length}</span>
              </h2>
              <ul className="space-y-2">{flagged.map(row)}</ul>
            </section>
          )}
          {rest.length > 0 && (
            <section>
              {flagged.length > 0 && <h2 className="mb-2 text-sm text-muted">{t("cc.onTrack")}</h2>}
              <ul className="space-y-2">{rest.map(row)}</ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}
