"use client";

import { useState } from "react";
import { PLANS, endDateFor } from "@/lib/business";
import { isISODate } from "@/lib/dates";
import { usePrefs } from "@/lib/i18n/client";
import { selectClass } from "@/components/ExerciseList";
import { Field, buttonClass, inputClass } from "@/components/ui";
import { createSubscription } from "../actions";

/** New subscription. The end date follows the plan and start date; the price starts from the last one used for that plan. */
export function SubscriptionForm({
  clients,
  lastPrices,
  today,
  preselect,
}: {
  clients: { id: string; full_name: string }[];
  lastPrices: Record<number, number>;
  today: string;
  preselect: string;
}) {
  const { t } = usePrefs();
  const [months, setMonths] = useState<number>(1);
  const [start, setStart] = useState(today);
  const [price, setPrice] = useState(lastPrices[1] != null ? String(lastPrices[1]) : "");

  return (
    <form action={createSubscription} className="space-y-3">
      <Field label={t("n.client")}>
        <select name="client_id" required defaultValue={preselect} className={`${selectClass} h-11 w-full`}>
          <option value="" disabled>
            —
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name || "—"}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label={t("sub.plan")}>
          <select
            name="plan_months"
            value={months}
            onChange={(e) => {
              const m = Number(e.target.value);
              setMonths(m);
              if (lastPrices[m] != null) setPrice(String(lastPrices[m]));
            }}
            className={`${selectClass} h-11 w-full`}
          >
            {PLANS.map((m) => (
              <option key={m} value={m}>
                {m} {m === 1 ? t("sub.months") : t("sub.months3")}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("sub.price")}>
          <input name="price_omr" required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className={`${inputClass} num text-center`} />
        </Field>
        <Field label={t("sub.status")}>
          <select name="payment_status" defaultValue="pending" className={`${selectClass} h-11 w-full`}>
            <option value="pending">{t("sub.pendingOne")}</option>
            <option value="paid">{t("sub.paid")}</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label={t("sub.start")}>
          <input name="start_date" type="date" required value={start} onChange={(e) => setStart(e.target.value)} className={`${inputClass} num px-1`} />
        </Field>
        <Field label={t("sub.end")}>
          <span className="num flex h-11 items-center justify-center rounded-md border border-line bg-bg text-sm text-muted">
            {isISODate(start) ? endDateFor(start, months) : "–"}
          </span>
        </Field>
        <Field label={t("sub.reminderDays")}>
          <input name="reminder_days_before" inputMode="numeric" defaultValue="7" className={`${inputClass} num text-center`} />
        </Field>
      </div>
      <Field label={t("w.notes")}>
        <input name="notes" className={inputClass} />
      </Field>
      <button className={buttonClass}>+ {t("sub.new")}</button>
    </form>
  );
}
