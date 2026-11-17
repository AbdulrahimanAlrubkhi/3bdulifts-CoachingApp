import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { getT } from "@/lib/i18n";
import { kcal, targetOn } from "@/lib/nutrition";
import { createClient } from "@/lib/supabase/server";
import { Card, PageTitle } from "@/components/ui";

// Client profile. For now it links to what is built; step 4 adds the profile, charts, photos and notes.
export default async function ClientPage({ params }: PageProps<"/coach/clients/[id]">) {
  const { id } = await params;
  await requireCoach();
  const { t } = await getT();
  const supabase = await createClient();

  const { data: client } = await supabase.from("profiles").select("id, full_name, role").eq("id", id).maybeSingle();
  if (!client || client.role !== "client") notFound();
  const target = await targetOn(supabase, id, todayISO());

  return (
    <>
      <PageTitle>{client.full_name || "—"}</PageTitle>
      <ul className="space-y-2">
        <li>
          <Link href={`/coach/clients/${id}/targets`}>
            <Card>
              <span className="block text-[15px] font-medium">{t("n.targets")}</span>
              <span className="mt-1 block text-sm text-muted">
                {target ? (
                  <>
                    {t(`phase.${target.phase}`)} · <span className="num">{kcal(target.calories)}</span> {t("n.kcal")} ·{" "}
                    {t("n.protein")} <span className="num">{target.protein_g}</span>
                    {t("n.g")}
                  </>
                ) : (
                  "—"
                )}
              </span>
            </Card>
          </Link>
        </li>
        <li>
          <Link href={`/coach/library/meal-plans?client=${id}`}>
            <Card className="text-[15px] font-medium">{t("n.plans")}</Card>
          </Link>
        </li>
      </ul>
    </>
  );
}
