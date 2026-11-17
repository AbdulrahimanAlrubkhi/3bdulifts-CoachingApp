"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireCoach, requireProfile } from "@/lib/auth";
import { getLocale } from "@/lib/i18n";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { EQUIPMENT, MUSCLES } from "@/lib/exercise-meta";
import { createClient } from "@/lib/supabase/server";

// Every action runs as the signed-in user, so row-level security decides what it may touch.

// ───────── exercises ─────────

export async function createExercise(formData: FormData) {
  const profile = await requireProfile();
  const name_ar = String(formData.get("name_ar") ?? "").trim();
  const name_en = String(formData.get("name_en") ?? "").trim();
  const muscle = String(formData.get("muscle"));
  const equipment = String(formData.get("equipment"));
  if (!name_ar && !name_en) return;
  if (!(MUSCLES as readonly string[]).includes(muscle) || !(EQUIPMENT as readonly string[]).includes(equipment)) return;

  const supabase = await createClient();
  await supabase.from("exercises").insert({
    name_ar: name_ar || name_en, // one name is enough; it fills both languages
    name_en: name_en || name_ar,
    muscle,
    equipment,
    created_by: profile.id,
    is_global: profile.role === "coach", // the coach's exercises are shared with every client
  });
  refresh();
}

export async function deleteExercise(formData: FormData) {
  await requireProfile();
  const supabase = await createClient();
  // fails harmlessly if the exercise is already used in a routine or workout
  await supabase.from("exercises").delete().eq("id", String(formData.get("id")));
  redirect("/workouts/exercises");
}

// ───────── routines ─────────

export async function createRoutine() {
  const profile = await requireProfile();
  const locale = await getLocale();
  const supabase = await createClient();
  const { data } = await supabase
    .from("routines")
    .insert({ owner_id: profile.id, title: dictionaries[locale]["w.newRoutine"] })
    .select("id")
    .single();
  redirect(data ? `/workouts/routines/${data.id}` : "/workouts");
}

export type RoutineInput = {
  title: string;
  notes: string;
  items: {
    exercise_id: string;
    target_sets: number;
    target_reps_min: number | null;
    target_reps_max: number | null;
    target_weight_kg: number | null;
    rest_seconds: number;
  }[];
};

export async function saveRoutine(id: string, input: RoutineInput): Promise<{ ok: boolean }> {
  await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("routines")
    .update({ title: input.title.trim() || "—", notes: input.notes.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false };

  // the exercise list is small, so it is simply replaced in the new order
  const { error: clearError } = await supabase.from("routine_exercises").delete().eq("routine_id", id);
  if (clearError) return { ok: false };
  if (input.items.length) {
    const { error: insertError } = await supabase.from("routine_exercises").insert(
      input.items.map((item, index) => ({
        routine_id: id,
        position: index,
        exercise_id: item.exercise_id,
        target_sets: Math.min(20, Math.max(1, Math.round(item.target_sets) || 1)),
        target_reps_min: item.target_reps_min,
        target_reps_max: item.target_reps_max,
        target_weight_kg: item.target_weight_kg,
        rest_seconds: Math.max(0, Math.round(item.rest_seconds) || 0),
      })),
    );
    if (insertError) return { ok: false };
  }
  return { ok: true };
}

export async function deleteRoutine(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();
  await supabase.from("routines").delete().eq("id", String(formData.get("id")));
  redirect(profile.role === "coach" ? "/coach/library" : "/workouts");
}

/** Turns the public share link on or off. Returns the token, or null when off. */
export async function setRoutineShare(id: string, on: boolean): Promise<string | null> {
  await requireProfile();
  const supabase = await createClient();
  const share_token = on ? crypto.randomUUID() : null;
  const { error } = await supabase.from("routines").update({ share_token }).eq("id", id);
  return error ? null : share_token;
}

export async function setRoutineAssignment(routineId: string, clientId: string, on: boolean): Promise<{ ok: boolean }> {
  await requireCoach();
  const supabase = await createClient();
  const { error } = on
    ? await supabase.from("routine_assignments").upsert({ routine_id: routineId, client_id: clientId })
    : await supabase.from("routine_assignments").delete().eq("routine_id", routineId).eq("client_id", clientId);
  return { ok: !error };
}

// ───────── workouts ─────────

/** Starts a workout, from a routine or empty. If one is already running, opens that instead. */
export async function startWorkout(formData: FormData) {
  const profile = await requireProfile();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: live } = await supabase
    .from("workouts")
    .select("id")
    .eq("user_id", profile.id)
    .is("ended_at", null)
    .limit(1)
    .maybeSingle();
  if (live) redirect(`/workouts/live/${live.id}`);

  const routineId = String(formData.get("routine_id") ?? "") || null;
  let title: string = dictionaries[locale]["w.workout"];
  let items: { exercise_id: string; position: number; target_sets: number; rest_seconds: number }[] = [];

  if (routineId) {
    const { data: routine } = await supabase
      .from("routines")
      .select("title, routine_exercises(exercise_id, position, target_sets, rest_seconds)")
      .eq("id", routineId)
      .single();
    if (routine) {
      title = routine.title;
      items = [...routine.routine_exercises].sort((a, b) => a.position - b.position);
    }
  }

  const { data: workout } = await supabase
    .from("workouts")
    .insert({ user_id: profile.id, routine_id: routineId, title })
    .select("id")
    .single();
  if (!workout) redirect("/workouts");

  if (items.length) {
    const { data: rows } = await supabase
      .from("workout_exercises")
      .insert(
        items.map((item, index) => ({
          workout_id: workout.id,
          user_id: profile.id,
          exercise_id: item.exercise_id,
          position: index,
          rest_seconds: item.rest_seconds,
        })),
      )
      .select("id, position");

    // one empty set per target set; the client fills them in as they lift
    const sets = (rows ?? []).flatMap((row) =>
      Array.from({ length: items[row.position].target_sets }, (_, i) => ({
        workout_exercise_id: row.id,
        user_id: profile.id,
        position: i,
      })),
    );
    if (sets.length) await supabase.from("workout_sets").insert(sets);
  }

  redirect(`/workouts/live/${workout.id}`);
}

export async function deleteWorkout(formData: FormData) {
  await requireProfile();
  const supabase = await createClient();
  await supabase.from("workouts").delete().eq("id", String(formData.get("id")));
  redirect("/workouts/history");
}
