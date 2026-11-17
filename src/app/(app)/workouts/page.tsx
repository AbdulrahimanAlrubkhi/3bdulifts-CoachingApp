import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { Card, PageTitle, buttonClass, ghostButtonClass } from "@/components/ui";
import { createRoutine, startWorkout } from "./actions";

type RoutineRow = { id: string; title: string; owner_id: string; routine_exercises: { count: number }[] };

export default async function WorkoutsPage() {
  const profile = await requireProfile();
  const { t } = await getT();
  const supabase = await createClient();

  const [{ data: live }, { data: routineRows }] = await Promise.all([
    supabase.from("workouts").select("id, title").eq("user_id", profile.id).is("ended_at", null).limit(1).maybeSingle(),
    // row-level security returns only this user's routines and the ones assigned to them
    supabase.from("routines").select("id, title, owner_id, routine_exercises(count)").order("updated_at", { ascending: false }),
  ]);
  const routines = (routineRows ?? []) as RoutineRow[];
  const mine = routines.filter((r) => r.owner_id === profile.id);
  const assigned = routines.filter((r) => r.owner_id !== profile.id);
  const isCoach = profile.role === "coach";

  const list = (items: RoutineRow[]) => (
    <ul className="space-y-2">
      {items.map((routine) => (
        <li key={routine.id}>
          <Card className="flex items-center justify-between gap-3">
            <Link href={`/workouts/routines/${routine.id}`} className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium">{routine.title}</span>
              <span className="num text-xs text-muted">{routine.routine_exercises[0]?.count ?? 0}</span>
              <span className="text-xs text-muted"> {t("w.exerciseCount")}</span>
            </Link>
            {!isCoach && !live && (
              <form action={startWorkout}>
                <input type="hidden" name="routine_id" value={routine.id} />
                <button className={`${ghostButtonClass} border-accent text-accent`}>{t("w.start")}</button>
              </form>
            )}
          </Card>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <PageTitle>{isCoach ? t("w.routines") : t("nav.workouts")}</PageTitle>

      {!isCoach && (
        <div className="mb-5 space-y-3">
          {live ? (
            <Link href={`/workouts/live/${live.id}`} className={`${buttonClass} flex items-center justify-center`}>
              {t("w.resume")}
            </Link>
          ) : (
            <form action={startWorkout}>
              <button className={buttonClass}>{t("w.startEmpty")}</button>
            </form>
          )}
          <nav className="grid grid-cols-3 gap-2 text-center text-sm">
            {(
              [
                ["/workouts/history", "w.history"],
                ["/workouts/exercises", "w.library"],
                ["/workouts/records", "w.records"],
              ] as const
            ).map(([href, key]) => (
              <Link key={href} href={href} className="rounded-md border border-line px-2 py-2.5 text-muted hover:text-text">
                {t(key)}
              </Link>
            ))}
          </nav>
        </div>
      )}

      {assigned.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm text-muted">{t("w.assigned")}</h2>
          {list(assigned)}
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm text-muted">{t("w.myRoutines")}</h2>
          <form action={createRoutine}>
            <button className={ghostButtonClass}>+ {t("w.newRoutine")}</button>
          </form>
        </div>
        {mine.length ? (
          list(mine)
        ) : (
          <Card>
            <p className="text-sm text-muted">{t("w.noRoutines")}</p>
          </Card>
        )}
      </section>
    </>
  );
}
