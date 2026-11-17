import Link from "next/link";
import { requireCoach } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { selectClass } from "@/components/ExerciseList";
import { Card, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { createMealPlan } from "../../nutrition-actions";

type PlanRow = {
  id: string;
  title: string;
  active: boolean;
  client_id: string | null;
  profiles: { full_name: string } | null;
  meal_options: { count: number }[];
};

export default async function MealPlansPage({ searchParams }: PageProps<"/coach/library/meal-plans">) {
  const { client } = await searchParams;
  const clientFilter = typeof client === "string" ? client : "";
  await requireCoach();
  const { t } = await getT();
  const supabase = await createClient();

  let query = supabase
    .from("meal_plans")
    .select("id, title, active, client_id, profiles(full_name), meal_options(count)")
    .order("created_at", { ascending: false });
  if (clientFilter) query = query.eq("client_id", clientFilter);
  const [{ data: plans }, { data: clients }] = await Promise.all([
    query,
    supabase.from("profiles").select("id, full_name").eq("role", "client").order("full_name"),
  ]);
  const rows = (plans ?? []) as unknown as PlanRow[];

  return (
    <>
      <PageTitle>{t("n.plans")}</PageTitle>

      <Card className="mb-4">
        <form action={createMealPlan} className="space-y-3">
          <input name="title" placeholder={t("n.planTitle")} aria-label={t("n.planTitle")} className={inputClass} />
          <select name="client_id" defaultValue={clientFilter} className={`${selectClass} h-11 w-full`} aria-label={t("n.client")}>
            <option value="">—</option>
            {(clients ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name || "—"}
              </option>
            ))}
          </select>
          <button className={buttonClass}>+ {t("n.newPlan")}</button>
        </form>
      </Card>

      {!rows.length ? (
        <Card>
          <p className="text-sm text-muted">{t("n.noPlans")}</p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {rows.map((plan) => (
            <li key={plan.id}>
              <Link href={`/coach/library/meal-plans/${plan.id}`}>
                <Card>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[15px] font-medium">{plan.title}</span>
                    <span className={`shrink-0 text-xs ${plan.active ? "text-accent" : "text-muted"}`}>
                      {plan.active ? t("n.active") : t("n.inactive")}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {plan.profiles?.full_name ?? "—"} · <span className="num">{plan.meal_options[0]?.count ?? 0}</span> {t("n.options")}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
