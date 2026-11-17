import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { PlanStatus } from "@/components/PlanStatus";
import { LocaleToggle, ThemeToggle } from "@/components/Prefs";
import { Card, PageTitle, ghostButtonClass, accentButtonClass } from "@/components/ui";
import { signout } from "../../(auth)/actions";
import { setUnit } from "./actions";

export default async function MorePage() {
  const profile = await requireProfile();
  const { t, locale } = await getT();
  const supabase = await createClient();
  const { data: challenges } =
    profile.role === "client" ? await supabase.from("challenges").select("id, title").order("start_date", { ascending: false }) : { data: [] };

  const row = "flex items-center justify-between py-3";

  return (
    <>
      {profile.role === "client" && (
        <div className="mb-5 space-y-2">
          <PlanStatus supabase={supabase} clientId={profile.id} t={t} locale={locale} />
          <Link href="/more/feedback" className="block">
            <Card className="text-[15px] font-medium">{t("fb.title")}</Card>
          </Link>
          {/* row-level security returns only the challenges this client is in */}
          {(challenges ?? []).map((c) => (
            <Link key={c.id} href={`/more/challenges/${c.id}`} className="block">
              <Card className="text-[15px] font-medium">
                <span className="block text-xs font-normal text-muted">{t("ch.title")}</span>
                {c.title}
              </Card>
            </Link>
          ))}
        </div>
      )}
      <PageTitle>{t("settings.title")}</PageTitle>
      <Card className="divide-y divide-line py-1">
        <div className={row}>
          <span className="text-sm">{t("settings.language")}</span>
          <LocaleToggle />
        </div>
        <div className={row}>
          <span className="text-sm">{t("settings.theme")}</span>
          <ThemeToggle dark={t("settings.dark")} light={t("settings.light")} />
        </div>
        <div className={row}>
          <span className="text-sm">{t("settings.units")}</span>
          <form action={setUnit} className="flex gap-2">
            {(["kg", "lb"] as const).map((unit) => (
              <button
                key={unit}
                name="unit"
                value={unit}
                className={`${profile.unit === unit ? accentButtonClass : ghostButtonClass}`}
              >
                {t(unit === "kg" ? "settings.kg" : "settings.lb")}
              </button>
            ))}
          </form>
        </div>
        <div className={row}>
          <span className="text-sm">
            {t("settings.account")}
            <span className="ms-2 text-muted">{profile.full_name}</span>
          </span>
          <form action={signout}>
            <button className={ghostButtonClass}>{t("auth.signout")}</button>
          </form>
        </div>
      </Card>
    </>
  );
}
