import { requireCoach } from "@/lib/auth";
import { SUBSCRIPTION_COLUMNS, type Subscription } from "@/lib/business";
import { todayISO } from "@/lib/dates";
import { getT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { Card, PageTitle } from "@/components/ui";
import { SubscriptionRow } from "../SubscriptionRow";
import { SubscriptionForm } from "./SubscriptionForm";

type ClientRow = { id: string; full_name: string; clients: { whatsapp: string | null } | { whatsapp: string | null }[] | null };

export default async function SubscriptionsPage({ searchParams }: PageProps<"/coach/business/subscriptions">) {
  const { client } = await searchParams;
  await requireCoach();
  const { t, locale } = await getT();
  const supabase = await createClient();
  const today = todayISO();

  const [{ data: subRows }, { data: clientRows }] = await Promise.all([
    supabase.from("subscriptions").select(SUBSCRIPTION_COLUMNS).order("end_date", { ascending: false }),
    supabase.from("profiles").select("id, full_name, clients(whatsapp)").eq("role", "client").order("full_name"),
  ]);
  const subs = ((subRows ?? []) as Subscription[]).map((s) => ({ ...s, price_omr: Number(s.price_omr) }));
  const clients = ((clientRows ?? []) as ClientRow[]).map((c) => ({
    id: c.id,
    full_name: c.full_name,
    whatsapp: (Array.isArray(c.clients) ? c.clients[0] : c.clients)?.whatsapp ?? null,
  }));
  const byId = new Map(clients.map((c) => [c.id, c]));
  // the most recent price charged for each plan length, as the form's starting value
  const lastPrices: Record<number, number> = {};
  for (const s of [...subs].sort((a, b) => a.start_date.localeCompare(b.start_date))) lastPrices[s.plan_months] = s.price_omr;
  const shown = typeof client === "string" ? subs.filter((s) => s.client_id === client) : subs;

  return (
    <>
      <PageTitle>{t("sub.title")}</PageTitle>
      <Card className="mb-4">
        <SubscriptionForm clients={clients} lastPrices={lastPrices} today={today} preselect={typeof client === "string" ? client : ""} />
      </Card>
      {!shown.length ? (
        <Card>
          <p className="text-sm text-muted">{t("sub.none")}</p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {shown.map((s) => (
            <li key={s.id}>
              <SubscriptionRow
                sub={s}
                name={byId.get(s.client_id)?.full_name ?? ""}
                whatsapp={byId.get(s.client_id)?.whatsapp ?? null}
                today={today}
                t={t}
                locale={locale}
                showDelete
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
