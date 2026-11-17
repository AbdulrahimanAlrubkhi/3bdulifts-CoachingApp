import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { EXERCISE_COLUMNS, type Exercise } from "@/lib/exercise-meta";
import { createClient } from "@/lib/supabase/server";
import { RoutineView } from "@/components/RoutineView";
import { PageTitle, buttonClass } from "@/components/ui";
import { startWorkout } from "../../actions";
import { RoutineEditor } from "./RoutineEditor";
import { toEditorItem } from "./editor-item";

type Row = Parameters<typeof toEditorItem>[0] & { position: number };

export default async function RoutinePage({ params }: PageProps<"/workouts/routines/[id]">) {
  const { id } = await params;
  const profile = await requireProfile();
  const { t, locale } = await getT();
  const supabase = await createClient();

  const { data: routine } = await supabase
    .from("routines")
    .select(
      "id, title, notes, owner_id, share_token, routine_exercises(id, exercise_id, position, target_sets, target_reps_min, target_reps_max, target_weight_kg, rest_seconds, exercises(name_ar, name_en))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!routine) notFound();

  const rows = ([...routine.routine_exercises] as unknown as Row[]).sort((a, b) => a.position - b.position);
  const isCoach = profile.role === "coach";
  const canEdit = isCoach || routine.owner_id === profile.id;

  // assigned by the coach: the client can follow it, not change it
  if (!canEdit) {
    return (
      <>
        <PageTitle>{routine.title}</PageTitle>
        <p className="-mt-3 mb-4 text-sm text-muted">{t("w.readOnly")}</p>
        {routine.notes && <p className="mb-4 text-sm whitespace-pre-wrap">{routine.notes}</p>}
        <RoutineView
          unit={profile.unit}
          items={rows.map((r) => ({ ...r, name: locale === "ar" ? r.exercises.name_ar : r.exercises.name_en }))}
        />
        <form action={startWorkout} className="mt-4">
          <input type="hidden" name="routine_id" value={routine.id} />
          <button className={buttonClass}>{t("w.start")}</button>
        </form>
      </>
    );
  }

  const [{ data: exercises }, clientsResult, assignmentsResult] = await Promise.all([
    supabase.from("exercises").select(EXERCISE_COLUMNS).order(locale === "ar" ? "name_ar" : "name_en"),
    isCoach ? supabase.from("profiles").select("id, full_name").eq("role", "client").order("full_name") : null,
    isCoach ? supabase.from("routine_assignments").select("client_id").eq("routine_id", id) : null,
  ]);
  const assignedIds = new Set((assignmentsResult?.data ?? []).map((a) => a.client_id));

  return (
    <RoutineEditor
      routine={{ id: routine.id, title: routine.title, notes: routine.notes ?? "", share_token: routine.share_token }}
      initialItems={rows.map((r) => toEditorItem(r, profile.unit))}
      exercises={(exercises ?? []) as Exercise[]}
      clients={
        isCoach
          ? (clientsResult?.data ?? []).map((c) => ({ id: c.id, full_name: c.full_name, assigned: assignedIds.has(c.id) }))
          : null
      }
    />
  );
}
