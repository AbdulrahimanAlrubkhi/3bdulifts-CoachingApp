import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { MEASUREMENTS, PHOTO_BUCKET, PHOTO_LINK_SECONDS, POSES, REFLECTIONS } from "@/lib/checkins";
import { formatDay, isISODate, todayISO, weekStartOf } from "@/lib/dates";
import { getT } from "@/lib/i18n";
import type { TKey } from "@/lib/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import { ScaleInput } from "@/components/ScaleInput";
import { Card, Field, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { saveWeeklyCheckin } from "../actions";
import { PhotoSlot } from "./PhotoSlot";

type WeeklyRow = {
  week_start: string;
  waist_cm: number | null;
  chest_cm: number | null;
  hip_cm: number | null;
  arm_cm: number | null;
  photo_front: string | null;
  photo_side: string | null;
  photo_back: string | null;
  reflections: Record<string, string | number> | null;
};

export default async function WeeklyCheckinPage({ searchParams }: PageProps<"/checkin/weekly">) {
  const params = await searchParams;
  const profile = await requireProfile();
  const { t, locale } = await getT();
  const thisWeek = weekStartOf(todayISO());
  // any date in the URL is snapped to the start of its week; future weeks fall back to this one
  const asked = isISODate(params.week) ? weekStartOf(params.week) : thisWeek;
  const week = asked > thisWeek ? thisWeek : asked;
  const supabase = await createClient();

  const [{ data: row }, { data: past }] = await Promise.all([
    supabase
      .from("weekly_checkins")
      .select("week_start, waist_cm, chest_cm, hip_cm, arm_cm, photo_front, photo_side, photo_back, reflections")
      .eq("user_id", profile.id)
      .eq("week_start", week)
      .maybeSingle(),
    supabase
      .from("weekly_checkins")
      .select("week_start, waist_cm")
      .eq("user_id", profile.id)
      .order("week_start", { ascending: false })
      .limit(12),
  ]);
  const weekly = row as WeeklyRow | null;

  // private bucket: photos are shown through signed links that expire after an hour
  const paths = POSES.map((p) => weekly?.[`photo_${p}`]).filter((p): p is string => Boolean(p));
  const { data: signed } = paths.length ? await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, PHOTO_LINK_SECONDS) : { data: [] };
  const urlFor = (path: string | null | undefined) => (path ? (signed ?? []).find((s) => s.path === path)?.signedUrl ?? null : null);
  const answers = weekly?.reflections ?? {};
  const dayFmt = { day: "numeric", month: "long" } as const;

  return (
    <>
      <PageTitle>{t("c.weekly")}</PageTitle>
      <p className="-mt-3 mb-4 text-sm text-muted">
        {t("c.weekOf")} {formatDay(week, locale, dayFmt)}
      </p>
      {params.saved && <p className="mb-3 text-sm text-accent" role="status">✓ {t("c.saved")}</p>}
      {params.error && <p className="mb-3 text-sm text-danger" role="alert">{t("w.saveFailed")}</p>}

      <Card className="mb-3">
        <h2 className="text-sm font-medium">{t("c.photos")}</h2>
        <p className="mt-0.5 mb-3 text-xs text-muted">{t("c.photosHint")}</p>
        <div className="grid grid-cols-3 gap-2">
          {POSES.map((pose) => (
            <PhotoSlot key={pose} pose={pose} week={week} url={urlFor(weekly?.[`photo_${pose}`])} label={t(`c.${pose}` as TKey)} />
          ))}
        </div>
      </Card>

      <form key={JSON.stringify(weekly)} action={saveWeeklyCheckin} className="space-y-3">
        <input type="hidden" name="week" value={week} />
        <Card>
          <h2 className="mb-3 text-sm font-medium">{t("c.measurements")}</h2>
          <div className="grid grid-cols-4 gap-2">
            {MEASUREMENTS.map((m) => (
              <Field key={m} label={t(`c.${m}` as TKey)}>
                <input
                  name={m}
                  inputMode="decimal"
                  defaultValue={weekly?.[m] == null ? "" : String(Number(weekly[m]))}
                  className={`${inputClass} num px-1 text-center`}
                />
              </Field>
            ))}
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-sm font-medium">{t("c.reflection")}</h2>
          {REFLECTIONS.map((q) =>
            q.kind === "score" ? (
              <ScaleInput
                key={q.key}
                name={`q_${q.key}`}
                label={t(`c.q.${q.key}` as TKey)}
                max={10}
                value={typeof answers[q.key] === "number" ? (answers[q.key] as number) : null}
              />
            ) : (
              <Field key={q.key} label={t(`c.q.${q.key}` as TKey)}>
                <textarea name={`q_${q.key}`} rows={2} defaultValue={String(answers[q.key] ?? "")} className={`${inputClass} h-auto py-2`} />
              </Field>
            ),
          )}
        </Card>

        <button className={buttonClass}>{t("c.saveWeekly")}</button>
      </form>

      {(past ?? []).length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm text-muted">{t("c.pastWeeks")}</h2>
          <Card className="py-1">
            <ul>
              {(past ?? []).map((p) => (
                <li key={p.week_start}>
                  <Link
                    href={p.week_start === thisWeek ? "/checkin/weekly" : `/checkin/weekly?week=${p.week_start}`}
                    className={`flex items-center justify-between border-b border-line py-2.5 text-sm last:border-b-0 ${p.week_start === week ? "text-accent" : ""}`}
                  >
                    <span>
                      {t("c.weekOf")} {formatDay(p.week_start, locale, dayFmt)}
                    </span>
                    {p.waist_cm != null && (
                      <span className="text-xs text-muted">
                        {t("c.waist_cm")} <span className="num text-text">{Number(p.waist_cm)}</span>
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </>
  );
}
