import type { SupabaseClient } from "@supabase/supabase-js";

/** One completed working set, from the v_set_stats view. */
export type SetStat = {
  set_id: string;
  exercise_id: string;
  workout_id: string;
  started_at: string;
  weight_kg: number;
  reps: number;
  volume_kg: number;
  est_1rm_kg: number;
};

/** All of a user's completed sets, oldest first. Pages through the API's 1000-row limit. */
export async function fetchSetStats(
  supabase: SupabaseClient,
  userId: string,
  exerciseId?: string,
): Promise<SetStat[]> {
  const all: SetStat[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    let query = supabase
      .from("v_set_stats")
      .select("set_id, exercise_id, workout_id, started_at, weight_kg, reps, volume_kg, est_1rm_kg")
      .eq("user_id", userId);
    if (exerciseId) query = query.eq("exercise_id", exerciseId);
    const { data } = await query
      .order("started_at")
      .order("set_id")
      .range(from, from + page - 1);
    const rows = (data ?? []) as SetStat[];
    all.push(
      ...rows.map((r) => ({
        ...r,
        weight_kg: Number(r.weight_kg),
        volume_kg: Number(r.volume_kg),
        est_1rm_kg: Number(r.est_1rm_kg),
      })),
    );
    if (rows.length < page) return all;
  }
}

export type ExerciseRecord = {
  best_weight_kg: number;
  best_est_1rm_kg: number;
  best_set_volume_kg: number;
  best_est_1rm_at: string;
};

export type WorkoutSummary = { volume_kg: number; sets: number; prSetIds: Set<string> };

/** One point per workout for one exercise: the session's best est. 1RM and its total volume. */
export type SessionPoint = { workout_id: string; started_at: string; est_1rm_kg: number; volume_kg: number };

/**
 * Turns the raw sets into what the screens need.
 * A PR is the best set of a workout when its estimated 1RM beats every earlier
 * workout for that exercise. The first time an exercise is logged is a baseline, not a PR.
 */
export function analyse(stats: SetStat[]) {
  const workouts = new Map<string, WorkoutSummary>();
  const records = new Map<string, ExerciseRecord>();
  const sessions = new Map<string, SessionPoint[]>(); // by exercise

  // group sets: workout -> exercise -> sets (stats arrive oldest first)
  const order: string[] = [];
  const grouped = new Map<string, Map<string, SetStat[]>>();
  for (const s of stats) {
    if (!grouped.has(s.workout_id)) {
      grouped.set(s.workout_id, new Map());
      order.push(s.workout_id);
    }
    const byExercise = grouped.get(s.workout_id)!;
    if (!byExercise.has(s.exercise_id)) byExercise.set(s.exercise_id, []);
    byExercise.get(s.exercise_id)!.push(s);
  }

  for (const workoutId of order) {
    const summary: WorkoutSummary = { volume_kg: 0, sets: 0, prSetIds: new Set() };
    for (const [exerciseId, sets] of grouped.get(workoutId)!) {
      const best = sets.reduce((a, b) => (b.est_1rm_kg > a.est_1rm_kg ? b : a));
      const volume = sets.reduce((sum, s) => sum + s.volume_kg, 0);
      summary.volume_kg += volume;
      summary.sets += sets.length;

      const previous = records.get(exerciseId);
      if (previous && best.est_1rm_kg > previous.best_est_1rm_kg) summary.prSetIds.add(best.set_id);

      const beats1rm = !previous || best.est_1rm_kg > previous.best_est_1rm_kg;
      records.set(exerciseId, {
        best_weight_kg: Math.max(previous?.best_weight_kg ?? 0, ...sets.map((s) => s.weight_kg)),
        best_set_volume_kg: Math.max(previous?.best_set_volume_kg ?? 0, ...sets.map((s) => s.volume_kg)),
        best_est_1rm_kg: beats1rm ? best.est_1rm_kg : previous.best_est_1rm_kg,
        best_est_1rm_at: beats1rm ? best.started_at : previous.best_est_1rm_at,
      });

      if (!sessions.has(exerciseId)) sessions.set(exerciseId, []);
      sessions.get(exerciseId)!.push({
        workout_id: workoutId,
        started_at: best.started_at,
        est_1rm_kg: best.est_1rm_kg,
        volume_kg: volume,
      });
    }
    workouts.set(workoutId, summary);
  }

  return { workouts, records, sessions };
}

export type PreviousSet = { weight_kg: number | null; reps: number | null };

/** For each exercise: the working sets from the last finished workout that included it. */
export async function fetchPrevious(
  supabase: SupabaseClient,
  userId: string,
  exerciseIds: string[],
  excludeWorkoutId: string,
): Promise<Record<string, PreviousSet[]>> {
  if (!exerciseIds.length) return {};
  const { data } = await supabase
    .from("workout_exercises")
    .select(
      "exercise_id, workouts!inner(started_at, ended_at), workout_sets(position, weight_kg, reps, completed_at, set_type)",
    )
    .eq("user_id", userId)
    .in("exercise_id", exerciseIds)
    .neq("workout_id", excludeWorkoutId)
    .not("workouts.ended_at", "is", null)
    .order("workouts(started_at)", { ascending: false })
    .limit(300);

  type Row = {
    exercise_id: string;
    workouts: { started_at: string };
    workout_sets: { position: number; weight_kg: number | null; reps: number | null; completed_at: string | null; set_type: string }[];
  };

  const latest: Record<string, { at: string; sets: PreviousSet[] }> = {};
  for (const row of (data ?? []) as unknown as Row[]) {
    const sets = row.workout_sets
      .filter((s) => s.completed_at && s.set_type !== "warmup")
      .sort((a, b) => a.position - b.position)
      .map((s) => ({ weight_kg: s.weight_kg == null ? null : Number(s.weight_kg), reps: s.reps }));
    if (!sets.length) continue;
    const current = latest[row.exercise_id];
    if (!current || row.workouts.started_at > current.at) {
      latest[row.exercise_id] = { at: row.workouts.started_at, sets };
    }
  }
  return Object.fromEntries(Object.entries(latest).map(([id, v]) => [id, v.sets]));
}
