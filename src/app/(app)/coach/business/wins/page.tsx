import Link from "next/link";
import { requireCoach } from "@/lib/auth";
import { PHOTO_BUCKET, PHOTO_LINK_SECONDS } from "@/lib/checkins";
import { CONSENT_COLUMNS, type ConsentRow } from "@/lib/consent";
import { ConsentBadges } from "@/components/ConsentBadges";
import { getT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { fmt, toDisplay } from "@/lib/units";
import { Card, ghostButtonClass } from "@/components/ui";

type Win = {
  id: string;
  title: string;
  quote: string | null;
  weeks: number | null;
  before_weight_kg: number | null;
  after_weight_kg: number | null;
  before_waist_cm: number | null;
  after_waist_cm: number | null;
  before_photo: string | null;
  after_photo: string | null;
  client_id: string | null;
  profiles: { full_name: string } | null;
};

// Results tracker (spec #20): client wins with before/after numbers, for marketing proof.
export default async function WinsPage() {
  const coach = await requireCoach();
  const { t, locale } = await getT();
  const supabase = await createClient();
  const { data } = await supabase
    .from("testimonials")
    .select("id, title, quote, weeks, before_weight_kg, after_weight_kg, before_waist_cm, after_waist_cm, before_photo, after_photo, client_id, profiles(full_name)")
    .order("created_at", { ascending: false });
  const wins = (data ?? []) as unknown as Win[];
  const clientIds = [...new Set(wins.map((w) => w.client_id).filter((id): id is string => Boolean(id)))];
  const { data: consentRows } = clientIds.length
    ? await supabase.from("publication_consents").select(CONSENT_COLUMNS).in("client_id", clientIds)
    : { data: [] };
  const consents = (consentRows ?? []) as ConsentRow[];
  const paths = wins.flatMap((w) => [w.before_photo, w.after_photo]).filter((p): p is string => Boolean(p));
  const { data: signed } = paths.length ? await supabase.storage.from(PHOTO_BUCKET).createSignedUrls([...new Set(paths)], PHOTO_LINK_SECONDS) : { data: [] };
  const url = (p: string | null) => (p ? (signed ?? []).find((s) => s.path === p)?.signedUrl ?? null : null);
  const w = (kg: number | null) => (kg == null ? null : fmt(toDisplay(Number(kg), coach.unit)));

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">{t("win.title")}</h1>
        <Link href="/coach/business/wins/new" className={`${ghostButtonClass} flex items-center`}>
          + {t("win.new")}
        </Link>
      </div>
      {!wins.length ? (
        <Card>
          <p className="text-sm text-muted">{t("win.none")}</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {wins.map((win) => {
            const change = win.before_weight_kg != null && win.after_weight_kg != null ? Number(win.after_weight_kg) - Number(win.before_weight_kg) : null;
            return (
              <li key={win.id}>
                <Link href={`/coach/business/wins/${win.id}`}>
                  <Card>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-[15px] font-medium">{win.title}</h2>
                        <p className="text-xs text-muted">{win.profiles?.full_name ?? "—"}</p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <ConsentBadges rows={consents} clientId={win.client_id} t={t} locale={locale} />
                    </div>
                    {(win.before_photo || win.after_photo) && (
                      // private photos stay visible to the coach; the badge above says whether they may be published
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {[win.before_photo, win.after_photo].map((p, i) => (
                          <div key={i} className="aspect-[3/4] overflow-hidden rounded-md border border-line bg-bg">
                            {url(p) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={url(p)!} alt={i === 0 ? t("win.before") : t("win.after")} className="h-full w-full object-cover" />
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <dt className="text-[11px] text-muted">{t("win.weight")}</dt>
                        <dd dir="ltr" className="text-end rtl:text-start">
                          <span className="num">{w(win.before_weight_kg) ?? "–"} → {w(win.after_weight_kg) ?? "–"}</span>
                          {change != null && (
                            <span className="num block text-xs text-accent">
                              {change > 0 ? "+" : "−"}
                              {fmt(Math.abs(toDisplay(change, coach.unit)!))} {coach.unit}
                            </span>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-muted">{t("win.waist")}</dt>
                        <dd className="num">
                          {win.before_waist_cm ?? "–"} → {win.after_waist_cm ?? "–"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-muted">{t("win.weeks")}</dt>
                        <dd className="num">{win.weeks ?? "–"}</dd>
                      </div>
                    </dl>
                    {win.quote && <p className="mt-3 border-s-2 border-line ps-3 text-sm whitespace-pre-wrap text-muted">{win.quote}</p>}
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
