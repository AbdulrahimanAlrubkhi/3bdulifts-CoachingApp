import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { fmt, fmtWeight, toDisplay } from "@/lib/units";
import { analyse, fetchSetStats } from "@/lib/workout-stats";
import { Card, PageTitle, ghostButtonClass } from "@/components/ui";
import { deleteWorkout } from "../../actions";

type Row = {
  id: string;
  exercise_id: string;
  position: number;
  exercises: { name_ar: string; name_en: string };
  workout_sets: { id: string; position: number; set_type: string; weight_kg: number | null; reps: number | null; rpe: number | null; completed_at: string | null }[];
};

export default async function WorkoutDetailPage({ params }: PageProps<"/workouts/history/[id]">) {
  const { id } = await params;
  const profile = await requireProfile();
  const { t, locale } = await getT();
  const supabase = await createClient();

  const { data: workout } = await supabase
    .from("workouts")
    .select("id, title, started_at, ended_at, user_id, notes")
    .eq("id", id)
    .maybeSingle();
  if (!workout) notFound();
  if (!workout.ended_at) redirect(`/workouts/live/${id}`);

  const [{ data: rowData }, stats] = await Promise.all([
    supabase
      .from("workout_exercises")
      .select("id, exercise_id, position, exercises(name_ar, name_en), workout_sets(id, position, set_type, weight_kg, reps, rpe, completed_at)")
      .eq("workout_id", id)
      .order("position"),
    fetchSetStats(supabase, workout.user_id),
  ]);
  const rows = (rowData ?? []) as unknown as Row[];
  const summary = analyse(stats).workouts.get(id);
  const minutes = Math.round((new Date(workout.ended_at).getTime() - new Date(workout.started_at).getTime()) / 60000);
  const dateFormat = new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en-GB", { dateStyle: "full" });

  return (
    <>
      <PageTitle>{workout.title}</PageTitle>
      <p className="-mt-3 mb-4 text-sm text-muted">{dateFormat.format(new Date(workout.started_at))}</p>

      <Card className="mb-3">
        <dl className="grid grid-cols-3 gap-3 text-center">
          <div>
            <dt className="text-xs text-muted">{t("w.duration")}</dt>
            <dd className="num mt-1 text-base font-semibold">
              {minutes} {t("w.min")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{t("w.volume")}</dt>
            <dd className="num mt-1 text-base font-semibold">{fmtWeight(summary?.volume_kg ?? 0, profile.unit)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{t("w.prs")}</dt>
            <dd className="num mt-1 text-base font-semibold">{summary?.prSetIds.size ?? 0}</dd>
          </div>
        </dl>
      </Card>

      <div className="space-y-3">
        {rows.map((row) => {
          const sets = row.workout_sets.filter((s) => s.completed_at).sort((a, b) => a.position - b.position);
          return (
            <Card key={row.id} className="p-3">
              <Link href={`/workouts/exercises/${row.exercise_id}`} className="text-[15px] font-medium">
                {locale === "ar" ? row.exercises.name_ar : row.exercises.name_en}
              </Link>
              <ol className="mt-2 space-y-1">
                {sets.map((set, index) => (
                  <li key={set.id} className="flex items-center gap-3 text-sm">
                    <span className="num w-5 text-muted">{index + 1}</span>
                    <span className="num">
                      {fmt(toDisplay(set.weight_kg, profile.unit))} {profile.unit} × {set.reps}
                    </span>
                    {set.rpe != null && <span className="num text-xs text-muted">RPE {Number(set.rpe)}</span>}
                    {summary?.prSetIds.has(set.id) && (
                      <span className="rounded border border-accent px-1.5 py-0.5 text-[11px] text-accent">{t("w.pr")}</span>
                    )}
                  </li>
                ))}
              </ol>
            </Card>
          );
        })}
      </div>

      {workout.user_id === profile.id && (
        <form action={deleteWorkout} className="mt-6">
          <input type="hidden" name="id" value={workout.id} />
          <button className={`${ghostButtonClass} text-danger`}>{t("w.delete")}</button>
        </form>
      )}
    </>
  );
}
