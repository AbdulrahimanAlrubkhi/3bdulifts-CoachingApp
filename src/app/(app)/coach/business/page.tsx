import Link from "next/link";
import { requireCoach } from "@/lib/auth";
import { SUBSCRIPTION_COLUMNS, currentSubscription, omr, subscriptionState, type Subscription } from "@/lib/business";
import { addDays, todayISO } from "@/lib/dates";
import { getT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { Card, PageTitle } from "@/components/ui";
import { SubscriptionRow } from "./SubscriptionRow";

type ClientRow = { id: string; full_name: string; clients: { whatsapp: string | null } | { whatsapp: string | null }[] | null };

// Business hub: what needs doing today (renewals, unpaid plans), then links to each area.
export default async function CoachBusinessPage() {
  await requireCoach();
  const { t, locale } = await getT();
  const supabase = await createClient();
  const today = todayISO();

  const [{ data: subRows }, { data: clientRows }] = await Promise.all([
    supabase.from("subscriptions").select(SUBSCRIPTION_COLUMNS),
    supabase.from("profiles").select("id, full_name, clients(whatsapp)").eq("role", "client"),
  ]);
  const subs = ((subRows ?? []) as Subscription[]).map((s) => ({ ...s, price_omr: Number(s.price_omr) }));
  const clients = new Map(
    ((clientRows ?? []) as ClientRow[]).map((c) => [c.id, { name: c.full_name, whatsapp: (Array.isArray(c.clients) ? c.clients[0] : c.clients)?.whatsapp ?? null }]),
  );

  // per client, only the plan that matters now: a renewed client stops showing as "ending"
  const current = [...clients.keys()]
    .map((id) => currentSubscription(subs.filter((s) => s.client_id === id), today))
    .filter((s): s is (typeof subs)[number] => Boolean(s));
  const renewals = current
    .filter((s) => {
      const state = subscriptionState(s, today);
      // ended within the last two weeks still needs a renewal conversation
      return state === "ending" || (state === "ended" && s.end_date >= addDays(today, -14));
    })
    .sort((a, b) => a.end_date.localeCompare(b.end_date));
  const pending = subs.filter((s) => s.payment_status === "pending" && !renewals.includes(s));
  const active = current.filter((s) => ["active", "ending"].includes(subscriptionState(s, today))).length;
  const month = today.slice(0, 7);
  const paidThisMonth = subs.filter((s) => s.payment_status === "paid" && s.start_date.startsWith(month)).reduce((sum, s) => sum + s.price_omr, 0);

  const row = (s: Subscription) => (
    <li key={s.id}>
      <SubscriptionRow sub={s} name={clients.get(s.client_id)?.name ?? ""} whatsapp={clients.get(s.client_id)?.whatsapp ?? null} today={today} t={t} locale={locale} />
    </li>
  );

  return (
    <>
      <PageTitle>{t("nav.business")}</PageTitle>
      <Card className="mb-4">
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-xs text-muted">{t("biz.activeClients")}</dt>
            <dd className="num mt-1 text-xl font-semibold">{active}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{t("biz.paidThisMonth")}</dt>
            <dd className="mt-1 text-xl font-semibold">
              <span className="num">{omr(paidThisMonth)}</span> <span className="text-xs font-normal text-muted">{t("sub.omr")}</span>
            </dd>
          </div>
        </dl>
      </Card>

      <section className="mb-4">
        <h2 className="mb-2 text-sm text-muted">{t("biz.renewals")}</h2>
        {renewals.length ? <ul className="space-y-2">{renewals.map(row)}</ul> : <p className="text-sm text-muted">{t("biz.noRenewals")}</p>}
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-sm text-muted">{t("biz.pending")}</h2>
        {pending.length ? <ul className="space-y-2">{pending.map(row)}</ul> : <p className="text-sm text-muted">{t("biz.noPending")}</p>}
      </section>

      <ul className="space-y-2">
        {(
          [
            ["/coach/business/subscriptions", "sub.title"],
            ["/coach/business/challenges", "ch.title"],
            ["/coach/business/wins", "win.title"],
          ] as const
        ).map(([href, key]) => (
          <li key={href}>
            <Link href={href}>
              <Card className="text-[15px] font-medium">{t(key)}</Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
