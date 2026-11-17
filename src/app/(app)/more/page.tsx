import { requireProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { LocaleToggle, ThemeToggle } from "@/components/Prefs";
import { Card, PageTitle, ghostButtonClass } from "@/components/ui";
import { signout } from "../../(auth)/actions";
import { setUnit } from "./actions";

export default async function MorePage() {
  const profile = await requireProfile();
  const { t } = await getT();

  const row = "flex items-center justify-between py-3";

  return (
    <>
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
                className={`${ghostButtonClass} ${profile.unit === unit ? "border-accent text-accent" : ""}`}
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
