import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/auth";
import { formatDay, todayISO } from "@/lib/dates";
import { getT } from "@/lib/i18n";
import { TARGET_COLUMNS, kcal, type Target } from "@/lib/nutrition";
import { createClient } from "@/lib/supabase/server";
import { Card, PageTitle, ghostButtonClass } from "@/components/ui";
import { deleteTarget } from "../../../nutrition-actions";
import { TargetForm } from "./TargetForm";

export default async function TargetsPage({ params }: PageProps<"/coach/clients/[id]/targets">) {
  const { id } = await params;
  await requireCoach();
  const { t, locale } = await getT();
  const supabase = await createClient();

  const [{ data: client }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("full_name, role").eq("id", id).maybeSingle(),
    supabase.from("nutrition_targets").select(TARGET_COLUMNS).eq("client_id", id).order("effective_from", { ascending: false }),
  ]);
  if (!client || client.role !== "client") notFound();

  const today = todayISO();
  const history = (rows ?? []) as Target[];
  // in force today = the latest that has already started; a future one waits its turn
  const current = history.find((r) => r.effective_from <= today) ?? null;

  return (
    <>
      <Link href={`/coach/clients/${id}`} className="text-sm text-muted">
        {client.full_name}
      </Link>
      <PageTitle>{t("n.targets")}</PageTitle>

      <Card className="mb-4">
        {/* keyed so the form starts fresh from the new current target after each save */}
        <TargetForm key={`${current?.id}-${history.length}`} clientId={id} current={current} today={today} />
      </Card>

      {history.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm text-muted">{t("n.history")}</h2>
          <ul className="space-y-2">
            {history.map((row) => (
              <li key={row.id}>
                <Card className={row.id === current?.id ? "border-accent" : ""}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[15px] font-medium">
                      {t(`phase.${row.phase}`)}
                      {row.id === current?.id && <span className="ms-2 text-xs text-accent">{t("n.current")}</span>}
                    </span>
                    <span className="text-xs text-muted">
                      {t("n.from")} {formatDay(row.effective_from, locale, { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <p className="mt-2 text-sm">
                    <span className="num">{kcal(row.calories)}</span> {t("n.kcal")} · {t("n.protein")}{" "}
                    <span className="num">{row.protein_g}</span> · {t("n.carbs")} <span className="num">{row.carbs_g}</span> ·{" "}
                    {t("n.fat")} <span className="num">{row.fat_g}</span>
                    {row.fiber_g != null && (
                      <>
                        {" "}
                        · {t("n.fiber")} <span className="num">{row.fiber_g}</span>
                      </>
                    )}
                    {row.water_ml != null && (
                      <>
                        {" "}
                        · {t("n.water")} <span className="num">{row.water_ml}</span> {t("n.ml")}
                      </>
                    )}
                  </p>
                  {row.note && <p className="mt-1 text-sm text-muted">{row.note}</p>}
                  <form action={deleteTarget} className="mt-2">
                    <input type="hidden" name="id" value={row.id} />
                    <button className={`${ghostButtonClass} h-8 text-xs text-danger`}>{t("w.delete")}</button>
                  </form>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
