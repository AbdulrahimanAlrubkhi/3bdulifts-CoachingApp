import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { EXPERIENCE, GOALS, PLACES } from "@/lib/clients";
import { getT } from "@/lib/i18n";
import type { TKey } from "@/lib/i18n/dictionaries";
import { Logo } from "@/components/Logo";
import { LocaleToggle, PrefsSync } from "@/components/Prefs";
import { selectClass } from "@/components/ExerciseList";
import { Card, Field, buttonClass, inputClass } from "@/components/ui";
import Loading from "../loading";
import { saveOnboarding } from "./actions";

// Shown once to every new client (spec #14). The signed-in pages send clients here until it's done.
export default function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6">
      <PrefsSync />
      <header className="mb-6 flex items-center justify-between">
        <Logo />
        <LocaleToggle />
      </header>
      <Suspense fallback={<Loading />}>
        <Questionnaire searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Questionnaire({ searchParams }: { searchParams: PageProps<"/onboarding">["searchParams"] }) {
  const profile = await requireProfile();
  if (profile.role === "coach" || profile.onboarded) redirect("/");
  const { t } = await getT();
  const { error } = await searchParams;

  const select = (name: string, options: readonly string[], prefix: string, required = true) => (
    <select name={name} required={required} defaultValue="" className={`${selectClass} h-11 w-full`}>
      <option value="" disabled>
        —
      </option>
      {options.map((o) => (
        <option key={o} value={o}>
          {t(`${prefix}.${o}` as TKey)}
        </option>
      ))}
    </select>
  );

  const section = "mb-3 text-sm font-medium";

  return (
    <form action={saveOnboarding} className="space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">{t("ob.title")}</h1>
      <p className="text-sm text-muted">{t("ob.intro")}</p>
      {error && <p className="text-sm text-danger">{t("w.saveFailed")}</p>}

      <Card className="space-y-3">
        <h2 className={section}>{t("ob.contact")}</h2>
        <Field label={t("auth.name")}>
          <input name="full_name" required defaultValue={profile.full_name} className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("ob.whatsapp")}>
            <input name="whatsapp" type="tel" required dir="ltr" placeholder="+968" className={`${inputClass} num`} />
          </Field>
          <Field label={t("ob.instagram")}>
            <input name="instagram" dir="ltr" placeholder="@" className={inputClass} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className={section}>{t("ob.about")}</h2>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t("ob.birthDate")}>
            <input name="birth_date" type="date" required className={`${inputClass} num px-1`} />
          </Field>
          <Field label={t("ob.height")}>
            <input name="height_cm" inputMode="decimal" required className={`${inputClass} num text-center`} />
          </Field>
          <Field label={`${t("ob.weight")} (${profile.unit})`}>
            <input name="weight" inputMode="decimal" required className={`${inputClass} num text-center`} />
          </Field>
        </div>
        <Field label={t("ob.goal")}>{select("goal", GOALS, "goal")}</Field>
        <Field label={t("ob.goalDetail")}>
          <textarea name="goal_detail" rows={2} className={`${inputClass} h-auto py-2`} />
        </Field>
        <Field label={t("ob.why")}>
          <textarea name="why_now" rows={2} className={`${inputClass} h-auto py-2`} />
        </Field>
      </Card>

      <Card className="space-y-3">
        <h2 className={section}>{t("ob.training")}</h2>
        <Field label={t("ob.experience")}>{select("experience", EXPERIENCE, "exp")}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("ob.days")}>
            <select name="training_days" required defaultValue="" className={`${selectClass} h-11 w-full`}>
              <option value="" disabled>
                —
              </option>
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("ob.place")}>{select("place", PLACES, "place")}</Field>
        </div>
        <Field label={t("ob.availability")}>
          <input name="availability" className={inputClass} />
        </Field>
        <Field label={t("ob.injuries")} hint={t("ob.injuriesHint")}>
          <textarea name="injuries" rows={2} required className={`${inputClass} h-auto py-2`} />
        </Field>
      </Card>

      <Card className="space-y-3">
        <h2 className={section}>{t("ob.food")}</h2>
        <Field label={t("ob.dislikes")}>
          <textarea name="dislikes" rows={2} className={`${inputClass} h-auto py-2`} />
        </Field>
        <Field label={t("ob.meals")}>
          <input name="meals_per_day" inputMode="numeric" className={`${inputClass} num w-24 text-center`} />
        </Field>
      </Card>

      <button className={buttonClass}>{t("ob.submit")}</button>
    </form>
  );
}
