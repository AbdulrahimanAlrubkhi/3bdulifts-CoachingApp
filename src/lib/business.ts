import { addDays, daysBetween } from "./dates";

export const PLANS = [1, 3, 6] as const;
export type PlanMonths = (typeof PLANS)[number];

export type Subscription = {
  id: string;
  client_id: string;
  plan_months: PlanMonths;
  price_omr: number;
  start_date: string;
  end_date: string;
  payment_status: "paid" | "pending";
  reminder_days_before: number;
  reminded_at: string | null;
  notes: string | null;
};

export const SUBSCRIPTION_COLUMNS =
  "id, client_id, plan_months, price_omr, start_date, end_date, payment_status, reminder_days_before, reminded_at, notes";

/** Last day of a plan: one month from 1 Nov runs to 30 Nov, inclusive. */
export function endDateFor(start: string, months: number): string {
  const [y, m, d] = start.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  // clamp to the month's length (31 Jan + 1 month -> 28/29 Feb), then step back a day
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return addDays(target.toISOString().slice(0, 10), -1);
}

export type SubscriptionState = "upcoming" | "active" | "ending" | "ended";

/** "ending" = inside the reminder window before the last day. */
export function subscriptionState(sub: Pick<Subscription, "start_date" | "end_date" | "reminder_days_before">, today: string): SubscriptionState {
  if (today < sub.start_date) return "upcoming";
  if (today > sub.end_date) return "ended";
  return daysBetween(today, sub.end_date) <= sub.reminder_days_before ? "ending" : "active";
}

/** 25 -> "25.000" (OMR has three decimal places). */
export function omr(value: number) {
  return Number(value).toFixed(3);
}

/** The renewal message the coach sends on WhatsApp, in the client's language (Arabic by default). */
export function renewalMessage(name: string, endDate: string, locale: "ar" | "en") {
  return locale === "ar"
    ? `مرحباً ${name}، اشتراكك في 3bdu.lifts ينتهي بتاريخ ${endDate}. حاب نكمل مع بعض للفترة الجاية؟`
    : `Hi ${name}, your 3bdu.lifts plan ends on ${endDate}. Would you like to continue for the next block?`;
}

/** A client's most relevant subscription: the one running today, else the next, else the latest. */
export function currentSubscription<T extends Pick<Subscription, "start_date" | "end_date">>(subs: T[], today: string): T | null {
  const running = subs.filter((s) => s.start_date <= today && s.end_date >= today).sort((a, b) => b.end_date.localeCompare(a.end_date));
  if (running.length) return running[0];
  const next = subs.filter((s) => s.start_date > today).sort((a, b) => a.start_date.localeCompare(b.start_date));
  if (next.length) return next[0];
  return [...subs].sort((a, b) => b.end_date.localeCompare(a.end_date))[0] ?? null;
}

/**
 * CSV with a byte-order mark so Excel opens Arabic text correctly.
 * Text a client typed (notes, food names) that starts with = + - @ or a tab could run as a formula
 * when the file is opened in Excel or Sheets, so such cells get a leading apostrophe. Real numbers,
 * including negatives like -3.6, are left alone.
 */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    let s = v == null ? "" : String(v);
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
