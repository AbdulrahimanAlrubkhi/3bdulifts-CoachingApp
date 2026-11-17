import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUBSCRIPTION_COLUMNS, currentSubscription, subscriptionState, type Subscription } from "@/lib/business";
import { daysBetween, formatDay, todayISO } from "@/lib/dates";
import type { TKey } from "@/lib/i18n/dictionaries";
import { Card } from "./ui";

/**
 * The client's own plan (spec #18). With `onlyWhenDue`, it renders nothing unless the plan is
 * ending, has ended, or is unpaid — that is the renewal reminder on Today.
 */
export async function PlanStatus({
  supabase,
  clientId,
  t,
  locale,
  onlyWhenDue = false,
}: {
  supabase: SupabaseClient;
  clientId: string;
  t: (key: TKey) => string;
  locale: "ar" | "en";
  onlyWhenDue?: boolean;
}) {
  const today = todayISO();
  const { data } = await supabase.from("subscriptions").select(SUBSCRIPTION_COLUMNS).eq("client_id", clientId);
  const sub = currentSubscription((data ?? []) as Subscription[], today);
  if (!sub) return null;
  const state = subscriptionState(sub, today);
  const due = state === "ending" || state === "ended" || sub.payment_status === "pending";
  if (onlyWhenDue && !due) return null;
  const left = daysBetween(today, sub.end_date);

  return (
    <Card className={due ? "border-accent" : ""}>
      <h2 className="text-sm font-medium">{t("sub.yours")}</h2>
      <p className="mt-1 text-sm">
        <span className="num">{sub.plan_months}</span> {sub.plan_months === 1 ? t("sub.months") : t("sub.months3")} · {t("sub.endsOn")}{" "}
        {formatDay(sub.end_date, locale, { day: "numeric", month: "long" })}
        {left >= 0 && (
          <span className="text-muted">
            {" "}
            (<span className="num">{left}</span> {t("sub.daysLeft")})
          </span>
        )}
      </p>
      {state === "ending" && <p className="mt-1 text-sm text-accent">{t("sub.renewSoon")}</p>}
      {state === "ended" && <p className="mt-1 text-sm text-accent">{t("sub.ended")}</p>}
      {sub.payment_status === "pending" && <p className="mt-1 text-sm text-muted">{t("sub.unpaid")}</p>}
    </Card>
  );
}
