import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { EXERCISE_COLUMNS, type Exercise } from "@/lib/exercise-meta";
import { createClient } from "@/lib/supabase/server";
import { fetchPrevious } from "@/lib/workout-stats";
import { LiveWorkout, type LiveExercise, type Target } from "./LiveWorkout";
import { toLiveSet, type SetRow } from "./live-set";

type ExerciseRow = {
  id: string;
  exercise_id: string;
  position: number;
  rest_seconds: number;
  exercises: { name_ar: string; name_en: string };
  workout_sets: SetRow[];
};

export default async function LiveWorkoutPage({ params }: PageProps<"/workouts/live/[id]">) {
  const { id } = await params;
  const profile = await requireProfile();
  const { locale } = await getT();
  const supabase = await createClient();

  const { data: workout } = await supabase
    .from("workouts")
    .select("id, title, started_at, ended_at, routine_id, user_id")
    .eq("id", id)
    .maybeSingle();
  if (!workout || workout.user_id !== profile.id) notFound();
  if (workout.ended_at) redirect(`/workouts/history/${id}`);

  const [{ data: rowData }, { data: library }, targetsResult] = await Promise.all([
    supabase
      .from("workout_exercises")
      .select(
        "id, exercise_id, position, rest_seconds, exercises(name_ar, name_en), workout_sets(id, position, set_type, weight_kg, reps, rpe, completed_at)",
      )
      .eq("workout_id", id)
      .order("position"),
    supabase.from("exercises").select(EXERCISE_COLUMNS).order(locale === "ar" ? "name_ar" : "name_en"),
    workout.routine_id
      ? supabase
          .from("routine_exercises")
          .select("exercise_id, target_reps_min, target_reps_max, target_weight_kg")
          .eq("routine_id", workout.routine_id)
      : null,
  ]);
  const rows = (rowData ?? []) as unknown as ExerciseRow[];

  const previous = await fetchPrevious(supabase, profile.id, rows.map((r) => r.exercise_id), id);
  const targets: Record<string, Target> = Object.fromEntries(
    (targetsResult?.data ?? []).map((target) => [target.exercise_id, target]),
  );

  const exercises: LiveExercise[] = rows.map((row) => ({
    id: row.id,
    exercise_id: row.exercise_id,
    rest_seconds: row.rest_seconds,
    name_ar: row.exercises.name_ar,
    name_en: row.exercises.name_en,
    sets: [...row.workout_sets].sort((a, b) => a.position - b.position).map((s) => toLiveSet(s, profile.unit)),
  }));

  return (
    <LiveWorkout
      workout={{ id: workout.id, title: workout.title, started_at: workout.started_at }}
      initialExercises={exercises}
      initialPrevious={previous}
      targets={targets}
      library={(library ?? []) as Exercise[]}
    />
  );
}
