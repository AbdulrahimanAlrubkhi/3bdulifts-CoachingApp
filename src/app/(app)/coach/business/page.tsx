import { requireCoach } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { ComingNext } from "@/components/ui";

export default async function CoachBusinessPage() {
  await requireCoach();
  const { t } = await getT();
  return <ComingNext title={t("nav.business")} text={t("common.soon")} step={5} />;
}
