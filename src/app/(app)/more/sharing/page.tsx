import { requireProfile } from "@/lib/auth";
import { CONSENT_COLUMNS, CONSENT_SCOPES, CONSENT_WORDING, consentStatus, type ConsentRow } from "@/lib/consent";
import { dateInAppTz, formatDay } from "@/lib/dates";
import { getT } from "@/lib/i18n";
import type { TKey } from "@/lib/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import { Card, PageTitle, accentButtonClass, ghostButtonClass } from "@/components/ui";
import { giveConsent, withdrawConsent } from "./actions";

// The client decides what may be published about them. Progress tracking stays private either way.
export default async function SharingPage() {
  const profile = await requireProfile();
  const { t, locale } = await getT();
  const supabase = await createClient();
  const { data } = await supabase.from("publication_consents").select(CONSENT_COLUMNS).eq("client_id", profile.id);
  const rows = (data ?? []) as ConsentRow[];
  const day = (ts: string) => formatDay(dateInAppTz(ts), locale, { day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <PageTitle>{t("cs.title")}</PageTitle>
      <p className="-mt-2 mb-4 text-sm text-muted">{t("cs.intro")}</p>
      <ul className="space-y-3">
        {CONSENT_SCOPES.map((scope) => {
          const status = consentStatus(rows, profile.id, scope);
          return (
            <li key={scope}>
              <Card>
                <h2 className="text-[15px] font-medium">{t(`cs.scope.${scope}` as TKey)}</h2>
                <p className="mt-2 text-sm leading-relaxed">{CONSENT_WORDING[scope][locale]}</p>
                <p className="mt-3 text-xs text-muted" role="status">
                  {status.state === "given"
                    ? `✓ ${t("cs.given")} ${day(status.since)}`
                    : status.state === "withdrawn"
                      ? `${t("cs.withdrawn")} ${day(status.since)}`
                      : t("cs.notGiven")}
                </p>
                <form action={status.state === "given" ? withdrawConsent : giveConsent} className="mt-3">
                  <input type="hidden" name="scope" value={scope} />
                  <button className={status.state === "given" ? ghostButtonClass : accentButtonClass}>
                    {status.state === "given" ? t("cs.withdraw") : t("cs.agree")}
                  </button>
                </form>
              </Card>
            </li>
          );
        })}
      </ul>
    </>
  );
}
