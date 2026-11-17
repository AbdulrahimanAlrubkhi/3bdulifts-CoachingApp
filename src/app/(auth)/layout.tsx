import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { LocaleToggle } from "@/components/Prefs";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col px-5 py-6">
      <header className="flex items-center justify-between">
        <Logo />
        <LocaleToggle />
      </header>
      <div className="flex flex-1 flex-col justify-center py-10">
        <Suspense>{children}</Suspense>
      </div>
    </main>
  );
}
