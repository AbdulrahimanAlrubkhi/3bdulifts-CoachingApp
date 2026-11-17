import { PHOTO_BUCKET, POSES } from "@/lib/checkins";
import { formatDay } from "@/lib/dates";
import type { TKey } from "@/lib/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import { selectClass } from "@/components/ExerciseList";
import { Card, Field, ghostButtonClass } from "@/components/ui";
import type { TabProps } from "./tab-props";

type PhotoWeek = { week_start: string; photo_front: string | null; photo_side: string | null; photo_back: string | null; waist_cm: number | null };

// Two weeks side by side, pose by pose (spec #16). Defaults to the first week with photos vs the latest.
export async function PhotosTab({ clientId, t, locale, sp }: TabProps) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("weekly_checkins")
    .select("week_start, photo_front, photo_side, photo_back, waist_cm")
    .eq("user_id", clientId)
    .or("photo_front.not.is.null,photo_side.not.is.null,photo_back.not.is.null")
    .order("week_start");
  const weeks = (data ?? []) as PhotoWeek[];
  if (!weeks.length) {
    return (
      <Card>
        <p className="text-sm text-muted">{t("cc.noPhotos")}</p>
      </Card>
    );
  }

  const pick = (value: unknown, fallback: PhotoWeek) => weeks.find((w) => w.week_start === value) ?? fallback;
  const a = pick(sp.a, weeks[0]);
  const b = pick(sp.b, weeks.at(-1)!);
  const paths = [a, b].flatMap((w) => POSES.map((p) => w[`photo_${p}`])).filter((p): p is string => Boolean(p));
  const { data: signed } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls([...new Set(paths)], 3600);
  const url = (path: string | null) => (path ? (signed ?? []).find((s) => s.path === path)?.signedUrl ?? null : null);
  const label = (w: PhotoWeek) => formatDay(w.week_start, locale, { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="space-y-3">
      {/* a plain GET form: choosing weeks just changes the URL */}
      <Card>
        <form className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <input type="hidden" name="tab" value="photos" />
          {(
            [
              ["a", "cc.weekA", a],
              ["b", "cc.weekB", b],
            ] as const
          ).map(([name, key, chosen]) => (
            <Field key={name} label={t(key)}>
              <select name={name} defaultValue={chosen.week_start} className={`${selectClass} h-10 w-full`}>
                {weeks.map((w) => (
                  <option key={w.week_start} value={w.week_start}>
                    {label(w)}
                  </option>
                ))}
              </select>
            </Field>
          ))}
          <button className={`${ghostButtonClass} h-10`}>{t("cc.compare")}</button>
        </form>
      </Card>

      {POSES.map((pose) => (
        <Card key={pose} className="p-3">
          <h2 className="mb-2 text-sm font-medium">{t(`c.${pose}` as TKey)}</h2>
          {/* always earlier on the left, later on the right, in both languages */}
          <div className="grid grid-cols-2 gap-2" dir="ltr">
            {[a, b].map((w, i) => {
              const src = url(w[`photo_${pose}`]);
              return (
                <figure key={i}>
                  <div className="aspect-[3/4] overflow-hidden rounded-md border border-line bg-bg">
                    {src ? (
                      // signed, short-lived links from private storage
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt={`${t(`c.${pose}` as TKey)} ${label(w)}`} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted">–</div>
                    )}
                  </div>
                  <figcaption className="mt-1 text-center text-xs text-muted" dir="auto">
                    {label(w)}
                    {w.waist_cm != null && (
                      <>
                        {" "}
                        · <span className="num">{Number(w.waist_cm)}</span> cm
                      </>
                    )}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}
