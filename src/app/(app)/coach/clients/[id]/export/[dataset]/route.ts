import { getProfile } from "@/lib/auth";
import { toCsv } from "@/lib/business";
import { REFLECTIONS } from "@/lib/checkins";
import { dateInAppTz, todayISO } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

// CSV export of one client's data (spec #21): /coach/clients/<id>/export/<dataset>
const DATASETS = ["daily", "weekly", "workouts", "food", "targets"] as const;
type Dataset = (typeof DATASETS)[number];

export async function GET(_req: Request, ctx: RouteContext<"/coach/clients/[id]/export/[dataset]">) {
  const { id, dataset } = await ctx.params;
  const profile = await getProfile();
  if (profile?.role !== "coach") return new Response("Forbidden", { status: 403 });
  if (!(DATASETS as readonly string[]).includes(dataset)) return new Response("Not found", { status: 404 });

  const supabase = await createClient();
  const { data: client } = await supabase.from("profiles").select("full_name").eq("id", id).maybeSingle();
  if (!client) return new Response("Not found", { status: 404 });
  const csv = await build(supabase, id, dataset as Dataset);

  const filename = `${client.full_name || "client"}-${dataset}-${todayISO()}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      // plain ASCII fallback plus the UTF-8 name, so Arabic names survive the download
      "Content-Disposition": `attachment; filename="${dataset}-${todayISO()}.csv"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}

async function build(supabase: Awaited<ReturnType<typeof createClient>>, id: string, dataset: Dataset): Promise<string> {
  switch (dataset) {
    case "daily": {
      const { data } = await supabase
        .from("daily_checkins")
        .select("check_date, weight_kg, steps, sleep_hours, energy, hunger, stress, notes")
        .eq("user_id", id)
        .order("check_date");
      return toCsv(
        ["date", "weight_kg", "steps", "sleep_hours", "energy_1_5", "hunger_1_5", "stress_1_5", "notes"],
        (data ?? []).map((r) => [r.check_date, r.weight_kg, r.steps, r.sleep_hours, r.energy, r.hunger, r.stress, r.notes]),
      );
    }
    case "weekly": {
      const { data } = await supabase
        .from("weekly_checkins")
        .select("week_start, waist_cm, chest_cm, hip_cm, arm_cm, reflections")
        .eq("user_id", id)
        .order("week_start");
      return toCsv(
        ["week_start", "waist_cm", "chest_cm", "hip_cm", "arm_cm", ...REFLECTIONS.map((q) => q.key)],
        (data ?? []).map((r) => [
          r.week_start,
          r.waist_cm,
          r.chest_cm,
          r.hip_cm,
          r.arm_cm,
          ...REFLECTIONS.map((q) => (r.reflections as Record<string, string | number> | null)?.[q.key] ?? ""),
        ]),
      );
    }
    case "workouts": {
      const { data } = await supabase
        .from("workouts")
        .select("title, started_at, ended_at, workout_exercises(position, exercises(name_en, name_ar), workout_sets(position, set_type, weight_kg, reps, rpe, completed_at))")
        .eq("user_id", id)
        .not("ended_at", "is", null)
        .order("started_at");
      type W = {
        title: string;
        started_at: string;
        workout_exercises: {
          position: number;
          exercises: { name_en: string; name_ar: string };
          workout_sets: { position: number; set_type: string; weight_kg: number | null; reps: number | null; rpe: number | null; completed_at: string | null }[];
        }[];
      };
      const rows: (string | number | null)[][] = [];
      for (const w of (data ?? []) as unknown as W[]) {
        for (const we of [...w.workout_exercises].sort((a, b) => a.position - b.position)) {
          for (const s of [...we.workout_sets].filter((s) => s.completed_at).sort((a, b) => a.position - b.position)) {
            rows.push([dateInAppTz(w.started_at), w.title, we.exercises.name_en, we.exercises.name_ar, s.position + 1, s.set_type, s.weight_kg, s.reps, s.rpe]);
          }
        }
      }
      return toCsv(["date", "workout", "exercise_en", "exercise_ar", "set", "type", "weight_kg", "reps", "rpe"], rows);
    }
    case "food": {
      const { data } = await supabase
        .from("food_logs")
        .select("log_date, meal, name, grams, calories, protein_g, carbs_g, fat_g, fiber_g")
        .eq("user_id", id)
        .order("log_date")
        .order("created_at")
        .limit(20000);
      return toCsv(
        ["date", "meal", "food", "grams", "kcal", "protein_g", "carbs_g", "fat_g", "fiber_g"],
        (data ?? []).map((r) => [r.log_date, r.meal, r.name, r.grams, r.calories, r.protein_g, r.carbs_g, r.fat_g, r.fiber_g]),
      );
    }
    case "targets": {
      const { data } = await supabase
        .from("nutrition_targets")
        .select("effective_from, phase, calories, protein_g, carbs_g, fat_g, fiber_g, water_ml, note")
        .eq("client_id", id)
        .order("effective_from");
      return toCsv(
        ["from", "phase", "kcal", "protein_g", "carbs_g", "fat_g", "fiber_g", "water_ml", "note"],
        (data ?? []).map((r) => [r.effective_from, r.phase, r.calories, r.protein_g, r.carbs_g, r.fat_g, r.fiber_g, r.water_ml, r.note]),
      );
    }
  }
}
