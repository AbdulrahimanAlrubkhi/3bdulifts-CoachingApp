// Permission to PUBLISH results (marketing). Separate from private progress tracking, which the
// coach always sees. Given and withdrawn by the client only; stored with the exact wording shown.
export const CONSENT_VERSION = "v1-2026-11";
export const CONSENT_SCOPES = ["results", "photos", "quote"] as const;
export type ConsentScope = (typeof CONSENT_SCOPES)[number];

/** The wording the client agrees to. Changing it means a new CONSENT_VERSION. */
export const CONSENT_WORDING: Record<ConsentScope, { ar: string; en: string }> = {
  results: {
    ar: "أسمح لـ 3bdu.lifts بنشر أرقام تقدمي (تغيّر الوزن، القياسات، عدد الأسابيع) مع اسمي الأول، مثلاً على إنستغرام. أستطيع سحب هذه الموافقة في أي وقت، وقد تبقى المنشورات السابقة منشورة.",
    en: "I allow 3bdu.lifts to publish my progress numbers (weight change, measurements, number of weeks) with my first name, for example on Instagram. I can withdraw this at any time; posts already published may stay online.",
  },
  photos: {
    ar: "أسمح بنشر صور تقدمي قبل وبعد. يُخفى وجهي ما لم أوافق كتابياً على غير ذلك. أستطيع سحب هذه الموافقة في أي وقت، وقد تبقى المنشورات السابقة منشورة.",
    en: "I allow my before and after progress photos to be published. My face is hidden unless I agree otherwise in writing. I can withdraw this at any time; posts already published may stay online.",
  },
  quote: {
    ar: "أسمح بنشر ما كتبته عن تجربتي مع اسمي الأول. أستطيع سحب هذه الموافقة في أي وقت، وقد تبقى المنشورات السابقة منشورة.",
    en: "I allow what I wrote about my experience to be published with my first name. I can withdraw this at any time; posts already published may stay online.",
  },
};

export type ConsentRow = {
  id: string;
  client_id: string;
  scope: ConsentScope;
  wording_version: string;
  locale: "ar" | "en";
  granted_at: string;
  withdrawn_at: string | null;
};

export const CONSENT_COLUMNS = "id, client_id, scope, wording_version, locale, granted_at, withdrawn_at";

export type ConsentStatus = { state: "given"; since: string; version: string } | { state: "withdrawn"; since: string } | { state: "none" };

/** Where each permission stands now: given, withdrawn (and when), or never given. */
export function consentStatus(rows: ConsentRow[], clientId: string, scope: ConsentScope): ConsentStatus {
  const mine = rows.filter((r) => r.client_id === clientId && r.scope === scope).sort((a, b) => b.granted_at.localeCompare(a.granted_at));
  const active = mine.find((r) => !r.withdrawn_at);
  if (active) return { state: "given", since: active.granted_at, version: active.wording_version };
  const last = mine[0];
  return last?.withdrawn_at ? { state: "withdrawn", since: last.withdrawn_at } : { state: "none" };
}
