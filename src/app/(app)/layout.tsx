import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { PrefsProvider } from "@/lib/i18n/client";
import { Logo } from "@/components/Logo";
import { TabBar, type Tab } from "@/components/TabBar";
import Loading from "../loading";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<Loading />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

// Signed-in shell: top bar + role-specific bottom tabs.
async function Shell({ children }: { children: ReactNode }) {
  const profile = await requireProfile();
  // new clients fill in the questionnaire before anything else (spec #14)
  if (!profile.onboarded) redirect("/onboarding");
  const { t, locale } = await getT();

  const tabs: Tab[] =
    profile.role === "coach"
      ? [
          { href: "/coach", label: t("nav.clients"), icon: "people" },
          { href: "/coach/library", label: t("nav.library"), icon: "book", also: ["/workouts"] },
          { href: "/coach/business", label: t("nav.business"), icon: "card" },
          { href: "/more", label: t("nav.more"), icon: "more" },
        ]
      : [
          { href: "/today", label: t("nav.today"), icon: "home" },
          { href: "/workouts", label: t("nav.workouts"), icon: "lift" },
          { href: "/nutrition", label: t("nav.nutrition"), icon: "food" },
          { href: "/checkin", label: t("nav.checkin"), icon: "check" },
          { href: "/more", label: t("nav.more"), icon: "more" },
        ];

  return (
    <PrefsProvider value={{ locale, unit: profile.unit, userId: profile.id, isCoach: profile.role === "coach" }}>
      <header className="sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-4">
          <Link href={tabs[0].href}>
            <Logo />
          </Link>
          <span className="text-xs text-muted">
            {profile.role === "coach" ? t("common.coach") : profile.full_name}
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl px-4 pt-5 pb-24">
        <Suspense fallback={<Loading />}>{children}</Suspense>
      </main>
      <TabBar tabs={tabs} />
    </PrefsProvider>
  );
}
