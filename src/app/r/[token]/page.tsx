import Link from "next/link";
import { getT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/env";
import { Logo } from "@/components/Logo";
import { RoutineView, type RoutineViewItem } from "@/components/RoutineView";
import { Card } from "@/components/ui";

type Shared = {
  title: string;
  notes: string | null;
  exercises: (Omit<RoutineViewItem, "name"> & { name_ar: string; name_en: string })[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Public page: anyone with the link can read this one routine, without an account.
export default async function SharedRoutinePage({ params }: PageProps<"/r/[token]">) {
  const { token } = await params;
  const { t, locale } = await getT();

  let routine: Shared | null = null;
  if (supabaseConfigured && UUID.test(token)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_shared_routine", { p_token: token });
    routine = (data as Shared | null) ?? null;
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6">
      <header className="mb-6">
        <Link href="/">
          <Logo />
        </Link>
      </header>
      {!routine ? (
        <Card>
          <p className="text-sm text-muted">{t("w.notFound")}</p>
        </Card>
      ) : (
        <>
          <p className="text-xs text-muted">{t("w.sharedRoutine")}</p>
          <h1 className="mt-1 mb-4 text-xl font-semibold tracking-tight">{routine.title}</h1>
          {routine.notes && <p className="mb-4 text-sm whitespace-pre-wrap">{routine.notes}</p>}
          <RoutineView
            unit="kg"
            items={routine.exercises.map((e) => ({ ...e, name: locale === "ar" ? e.name_ar : e.name_en }))}
          />
        </>
      )}
    </main>
  );
}
