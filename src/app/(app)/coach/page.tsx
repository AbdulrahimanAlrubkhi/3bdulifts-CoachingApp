import Link from "next/link";
import { requireCoach } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { Card, PageTitle } from "@/components/ui";

// Coach dashboard. For now: the real client list.
// Step 4 adds last check-in, 7-day average weight, adherence and flags per client.
export default async function CoachDashboard() {
  await requireCoach();
  const { t, locale } = await getT();
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("profiles")
    .select("id, full_name, created_at")
    .eq("role", "client")
    .order("created_at", { ascending: false });

  const dateFormat = new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en-GB", { dateStyle: "medium" });

  return (
    <>
      <PageTitle>{t("coach.clients")}</PageTitle>
      {!clients?.length ? (
        <Card>
          <p className="text-sm text-muted">{t("coach.noClients")}</p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {clients.map((client) => (
            <li key={client.id}>
              <Link href={`/coach/clients/${client.id}`}>
                <Card className="flex items-center justify-between">
                  <span className="text-[15px] font-medium">{client.full_name || "—"}</span>
                  <span className="text-xs text-muted">
                    {t("coach.joined")} {dateFormat.format(new Date(client.created_at))}
                  </span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
