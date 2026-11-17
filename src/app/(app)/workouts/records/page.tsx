import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { fmtWeight } from "@/lib/units";
import { analyse, fetchSetStats } from "@/lib/workout-stats";
import { Card, PageTitle } from "@/components/ui";

export default async function RecordsPage() {
  const profile = await requireProfile();
  const { t, locale } = await getT();
  const supabase = await createClient();

  const { records } = analyse(await fetchSetStats(supabase, profile.id));
  const ids = [...records.keys()];
  const { data: exercises } = ids.length
    ? await supabase.from("exercises").select("id, name_ar, name_en").in("id", ids)
    : { data: [] };

  const rows = (exercises ?? [])
    .map((e) => ({ id: e.id, name: locale === "ar" ? e.name_ar : e.name_en, record: records.get(e.id)! }))
    .sort((a, b) => b.record.best_est_1rm_kg - a.record.best_est_1rm_kg);
  const dateFormat = new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <>
      <PageTitle>{t("w.records")}</PageTitle>
      {!rows.length ? (
        <Card>
          <p className="text-sm text-muted">{t("w.noData")}</p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ id, name, record }) => (
            <li key={id}>
              <Link href={`/workouts/exercises/${id}`}>
                <Card>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[15px] font-medium">{name}</span>
                    <span className="shrink-0 text-xs text-muted">{dateFormat.format(new Date(record.best_est_1rm_at))}</span>
                  </div>
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted">
                    {(
                      [
                        ["w.est1rm", record.best_est_1rm_kg],
                        ["w.bestWeight", record.best_weight_kg],
                        ["w.bestSet", record.best_set_volume_kg],
                      ] as const
                    ).map(([key, kg]) => (
                      <div key={key}>
                        <dt>{t(key)}</dt>
                        <dd className="num mt-0.5 text-sm text-text">{fmtWeight(kg, profile.unit)}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
