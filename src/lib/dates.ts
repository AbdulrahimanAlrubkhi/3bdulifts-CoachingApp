// Days are counted in Oman time, so "today" is the same for the coach and every client
// no matter where the server runs.
export const APP_TZ = "Asia/Muscat";
/** Oman has no daylight saving, so its offset is fixed. Keep in step with APP_TZ. */
export const APP_UTC_OFFSET = "+04:00";
/** Weeks start on Sunday, the first working day in Oman (0 = Sunday … 6 = Saturday). */
export const WEEK_START_DAY = 0;

/** Start (inclusive) and end (exclusive) of a calendar day in Oman, as timestamps for queries. */
export function dayBounds(iso: string): [string, string] {
  return [`${iso}T00:00:00${APP_UTC_OFFSET}`, `${addDays(iso, 1)}T00:00:00${APP_UTC_OFFSET}`];
}

/** The first day of the week that `iso` falls in. */
export function weekStartOf(iso: string): string {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return addDays(iso, -((day - WEEK_START_DAY + 7) % 7));
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-11-17" for the current day in Oman. */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ }).format(new Date());
}

export function isISODate(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE.test(value) && !Number.isNaN(Date.parse(value));
}

/** A valid date from the URL, or today. */
export function dateParam(value: unknown): string {
  return isISODate(value) ? value : todayISO();
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Formats a calendar date without shifting it through a time zone. */
export function formatDay(iso: string, locale: "ar" | "en", options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en-GB", { ...options, timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

/** The Oman calendar date of a timestamp, e.g. when a workout started. */
export function dateInAppTz(timestamp: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ }).format(new Date(timestamp));
}

/** Whole days from `from` to `to` (both ISO dates). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}
