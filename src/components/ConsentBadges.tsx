import { CONSENT_SCOPES, consentStatus, type ConsentRow } from "@/lib/consent";
import { dateInAppTz, formatDay } from "@/lib/dates";
import type { TKey } from "@/lib/i18n/dictionaries";

/**
 * What the client has agreed may be published, per part of a win (numbers, photos, quote).
 * Only the client can give this, in their app; the coach just reads it here.
 */
export function ConsentBadges({ rows, clientId, t, locale }: { rows: ConsentRow[]; clientId: string | null; t: (key: TKey) => string; locale: "ar" | "en" }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {CONSENT_SCOPES.map((scope) => {
        const s = clientId ? consentStatus(rows, clientId, scope) : ({ state: "none" } as const);
        const label = t(`cs.scope.${scope}` as TKey);
        const day = s.state !== "none" ? formatDay(dateInAppTz(s.since), locale, { day: "numeric", month: "short" }) : "";
        return (
          <li
            key={scope}
            className={`rounded border px-1.5 py-0.5 text-[11px] ${
              s.state === "given" ? "border-accent text-accent" : s.state === "withdrawn" ? "border-danger/60 text-danger" : "border-line text-muted"
            }`}
          >
            {s.state === "given" ? `✓ ${label}` : s.state === "withdrawn" ? `! ${label}: ${t("cs.withdrawnShort")} ${day}` : `✗ ${label}`}
          </li>
        );
      })}
    </ul>
  );
}
