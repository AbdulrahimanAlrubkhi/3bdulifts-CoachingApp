import Link from "next/link";
import { Logo } from "@/components/Logo";

// Bilingual on purpose: this page can appear before the language preference is known.
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo />
      <p className="text-base" dir="rtl" lang="ar">
        هذه الصفحة غير موجودة أو ليس لديك صلاحية لفتحها.
      </p>
      <p className="text-sm text-muted" dir="ltr" lang="en">
        This page doesn&apos;t exist, or you don&apos;t have access to it.
      </p>
      <Link href="/" className="text-sm text-accent underline underline-offset-4">
        3bdu.lifts
      </Link>
    </main>
  );
}
