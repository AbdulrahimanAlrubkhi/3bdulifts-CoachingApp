import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import type { TKey } from "@/lib/i18n/dictionaries";
import { EXERCISE_COLUMNS, type Exercise } from "@/lib/exercise-meta";
import { createClient } from "@/lib/supabase/server";
import { fmtWeight, toDisplay } from "@/lib/units";
import { analyse, fetchSetStats } from "@/lib/workout-stats";
import { ExerciseCharts } from "@/components/ExerciseCharts";
import { Card, PageTitle, ghostButtonClass } from "@/components/ui";
import { deleteExercise } from "../../actions";

export default async function ExercisePage({ params }: PageProps<"/workouts/exercises/[id]">) {
  const { id } = await params;
  const profile = await requireProfile();
  const { t, locale } = await getT();
  const supabase = await createClient();

  const { data } = await supabase.from("exercises").select(EXERCISE_COLUMNS).eq("id", id).maybeSingle();
  const exercise = data as Exercise | null;
  if (!exercise) notFound();

  const { records, sessions } = analyse(await fetchSetStats(supabase, profile.id, id));
  const record = records.get(id);
  const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
  const points = (sessions.get(id) ?? []).map((s) => ({
    label: dayFormat.format(new Date(s.started_at)),
    est1rm: toDisplay(s.est_1rm_kg, profile.unit) ?? 0,
    volume: Math.round(toDisplay(s.volume_kg, profile.unit) ?? 0),
  }));

  const canDelete = profile.role === "coach" || (!exercise.is_global && exercise.created_by === profile.id);

  return (
    <>
      <PageTitle>{locale === "ar" ? exercise.name_ar : exercise.name_en}</PageTitle>
      <p className="-mt-3 mb-4 text-sm text-muted">
        {t(`muscle.${exercise.muscle}` as TKey)} · {t(`equip.${exercise.equipment}` as TKey)}
      </p>

      {!record ? (
        <Card>
          <p className="text-sm text-muted">{t("w.noData")}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          <Card>
            <dl className="grid grid-cols-3 gap-3 text-center">
              {(
                [
                  ["w.est1rm", record.best_est_1rm_kg],
                  ["w.bestWeight", record.best_weight_kg],
                  ["w.bestSet", record.best_set_volume_kg],
                ] as const
              ).map(([key, kg]) => (
                <div key={key}>
                  <dt className="text-xs text-muted">{t(key)}</dt>
                  <dd className="num mt-1 text-base font-semibold">{fmtWeight(kg, profile.unit)}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card>
            <ExerciseCharts
              points={points}
              unit={profile.unit}
              est1rmTitle={t("w.est1rmChart")}
              volumeTitle={t("w.volumeChart")}
            />
          </Card>
        </div>
      )}

      {canDelete && (
        <form action={deleteExercise} className="mt-6">
          <input type="hidden" name="id" value={exercise.id} />
          <button className={`${ghostButtonClass} text-danger`}>{t("w.delete")}</button>
        </form>
      )}
    </>
  );
}
