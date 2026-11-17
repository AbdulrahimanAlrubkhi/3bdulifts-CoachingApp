import { requireProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { ComingNext } from "@/components/ui";

export default async function CheckinPage() {
  await requireProfile();
  const { t } = await getT();
  return <ComingNext title={t("nav.checkin")} text={t("common.soon")} step={3} />;
}
