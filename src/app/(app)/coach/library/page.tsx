import Link from "next/link";
import { requireCoach } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { Card, PageTitle } from "@/components/ui";

export default async function CoachLibraryPage() {
  await requireCoach();
  const { t } = await getT();

  return (
    <>
      <PageTitle>{t("nav.library")}</PageTitle>
      <ul className="space-y-2">
        {(
          [
            ["/workouts", "w.routines"],
            ["/workouts/exercises", "w.library"],
            ["/coach/library/meal-plans", "n.plans"],
            ["/coach/library/foods", "n.foods"],
          ] as const
        ).map(([href, key]) => (
          <li key={href}>
            <Link href={href}>
              <Card className="text-[15px] font-medium">{t(key)}</Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
