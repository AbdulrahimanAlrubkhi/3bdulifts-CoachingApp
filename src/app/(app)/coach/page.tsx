import Link from "next/link";
import { requireCoach } from "@/lib/auth";
import { loadClientMetrics } from "@/lib/coach-data";
import type { ClientMetrics } from "@/lib/coach-metrics";
import { getT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { FlagChip, NutritionPct, Pct, WeightAndTrend, lastCheckinText } from "@/components/MetricBits";
import { Card, PageTitle, buttonInlineClass, inputClass } from "@/components/ui";
import { inviteClient, removeInvite } from "./client-admin-actions";

// Coach dashboard (spec #15): every client at a glance, clients with flags first.
export default async function CoachDashboard({ searchParams }: PageProps<"/coach">) {
  const showArchived = (await searchParams).archived === "1";
  const profile = await requireCoach();
  const { t } = await getT();
  const supabase = await createClient();
  const [{ clients: everyone, metrics }, { data: inviteRows }] = await Promise.all([
    loadClientMetrics(supabase),
    supabase.from("client_invites").select("email, invited_at").order("invited_at", { ascending: false }),
  ]);
  const clients = everyone.filter((c) => c.archived === showArchived);
  const archivedCount = everyone.filter((c) => c.archived).length;
  // an invite is "waiting" until someone signs up with that email
  const joined = new Set(everyone.map((c) => (c.email ?? "").toLowerCase()));
  const waiting = (inviteRows ?? []).filter((i) => !joined.has(i.email));

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
      <PageTitle>{showArchived ? t("cc.archived") : t("coach.clients")}</PageTitle>
      {!showArchived && (
        <Card className="mb-4">
          <h2 className="text-sm font-medium">{t("inv.title")}</h2>
          <p className="mt-0.5 mb-3 text-xs text-muted">{t("inv.hint")}</p>
          <form action={inviteClient} className="flex gap-2">
            <input name="email" type="email" required dir="ltr" placeholder="name@example.com" aria-label={t("auth.email")} className={inputClass} />
            <button className={`${buttonInlineClass}`}>{t("inv.add")}</button>
          </form>
          {waiting.length > 0 && (
            <ul className="mt-3 border-t border-line pt-2 text-sm">
              {waiting.map((i) => (
                <li key={i.email} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="truncate" dir="ltr">
                    {i.email}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                    {t("inv.waiting")}
                    <form action={removeInvite}>
                      <input type="hidden" name="email" value={i.email} />
                      <button className="h-8 px-2 hover:text-danger">{t("w.remove")}</button>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
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
      {(archivedCount > 0 || showArchived) && (
        <Link href={showArchived ? "/coach" : "/coach?archived=1"} className="mt-5 block text-center text-sm text-muted underline underline-offset-4">
          {showArchived ? t("coach.clients") : `${t("cc.archived")} (${archivedCount})`}
        </Link>
      )}
    </>
  );
}
