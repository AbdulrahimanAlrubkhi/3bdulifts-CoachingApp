import { omr, renewalMessage, subscriptionState, type Subscription } from "@/lib/business";
import { whatsappLink } from "@/lib/clients";
import { daysBetween, formatDay, dateInAppTz } from "@/lib/dates";
import type { TKey } from "@/lib/i18n/dictionaries";
import { Card, accentButtonClass, ghostButtonClass } from "@/components/ui";
import { deleteSubscription, markReminded, setPaymentStatus } from "./actions";

type T = (key: TKey) => string;

/** One subscription with its state, payment toggle and (when ending) a WhatsApp reminder. */
export function SubscriptionRow({
  sub,
  name,
  whatsapp,
  today,
  t,
  locale,
  showDelete = false,
}: {
  sub: Subscription;
  name: string;
  whatsapp: string | null;
  today: string;
  t: T;
  locale: "ar" | "en";
  showDelete?: boolean;
}) {
  const state = subscriptionState(sub, today);
  const fmt = (d: string) => formatDay(d, locale, { day: "numeric", month: "short", year: "numeric" });
  const left = daysBetween(today, sub.end_date);
  const wa = whatsappLink(whatsapp);
  const remindHref = wa ? `${wa}?text=${encodeURIComponent(renewalMessage(name, fmt(sub.end_date), locale))}` : null;
  const small = "h-8 rounded-md px-2.5 text-xs";

  return (
    <Card className={`p-3 ${state === "ending" ? "border-accent" : ""}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[15px] font-medium">{name || "—"}</span>
        <span className="shrink-0 text-sm">
          <span className="num">{omr(sub.price_omr)}</span> <span className="text-xs text-muted">{t("sub.omr")}</span>
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">
        <span className="num">{sub.plan_months}</span> {sub.plan_months === 1 ? t("sub.months") : t("sub.months3")} · {fmt(sub.start_date)} – {fmt(sub.end_date)}
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className={state === "ending" ? "text-accent" : state === "ended" ? "text-muted" : ""}>
          {t(`sub.state.${state}` as TKey)}
          {(state === "active" || state === "ending") && (
            <span className="text-muted">
              {" "}
              · <span className="num">{left}</span> {t("sub.daysLeft")}
            </span>
          )}
        </span>
        {/* payment state as words, not colour alone */}
        <span className={sub.payment_status === "paid" ? "text-muted" : "text-danger"}>
          {sub.payment_status === "paid" ? `✓ ${t("sub.paid")}` : `! ${t("sub.pendingOne")}`}
        </span>
        {sub.reminded_at && (
          <span className="text-muted">
            {t("sub.remindedOn")} {formatDay(dateInAppTz(sub.reminded_at), locale, { day: "numeric", month: "short" })}
          </span>
        )}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <form action={setPaymentStatus}>
          <input type="hidden" name="id" value={sub.id} />
          <input type="hidden" name="status" value={sub.payment_status === "paid" ? "pending" : "paid"} />
          <button className={`${sub.payment_status === "paid" ? ghostButtonClass : accentButtonClass} ${small}`}>
            {sub.payment_status === "paid" ? t("sub.markPending") : t("sub.markPaid")}
          </button>
        </form>
        {(state === "ending" || state === "ended") && remindHref && (
          <a href={remindHref} target="_blank" rel="noreferrer" className={`${accentButtonClass} ${small} inline-flex items-center`}>
            {t("sub.remind")}
          </a>
        )}
        {(state === "ending" || state === "ended") && (
          <form action={markReminded}>
            <input type="hidden" name="id" value={sub.id} />
            <button className={`${ghostButtonClass} ${small}`}>{t("sub.markReminded")}</button>
          </form>
        )}
        {showDelete && (
          <form action={deleteSubscription} className="ms-auto">
            <input type="hidden" name="id" value={sub.id} />
            <button className={`${small} text-muted hover:text-danger`}>{t("w.delete")}</button>
          </form>
        )}
      </div>
    </Card>
  );
}
