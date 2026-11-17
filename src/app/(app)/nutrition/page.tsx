import { requireProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { ComingNext } from "@/components/ui";

export default async function NutritionPage() {
  await requireProfile();
  const { t } = await getT();
  return <ComingNext title={t("nav.nutrition")} text={t("common.soon")} step={2} />;
}
