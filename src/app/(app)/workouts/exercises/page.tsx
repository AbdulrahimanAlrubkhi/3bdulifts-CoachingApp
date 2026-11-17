import { requireProfile } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import type { TKey } from "@/lib/i18n/dictionaries";
import { EQUIPMENT, EXERCISE_COLUMNS, MUSCLES, type Exercise } from "@/lib/exercise-meta";
import { createClient } from "@/lib/supabase/server";
import { ExerciseList, selectClass } from "@/components/ExerciseList";
import { Card, Field, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { createExercise } from "../actions";

export default async function ExercisesPage() {
  await requireProfile();
  const { t, locale } = await getT();
  const supabase = await createClient();
  const { data } = await supabase
    .from("exercises")
    .select(EXERCISE_COLUMNS)
    .order(locale === "ar" ? "name_ar" : "name_en");
  const exercises = (data ?? []) as Exercise[];

  return (
    <>
      <PageTitle>{t("w.library")}</PageTitle>

      <details className="mb-4 rounded-lg border border-line bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">{t("w.custom")}</summary>
        <form action={createExercise} className="space-y-3 px-4 pb-4">
          <Field label={t("w.nameAr")}>
            <input name="name_ar" className={inputClass} dir="rtl" />
          </Field>
          <Field label={t("w.nameEn")}>
            <input name="name_en" className={inputClass} dir="ltr" />
          </Field>
          <div className="flex gap-2">
            <select name="muscle" className={selectClass} aria-label={t("w.muscle")} defaultValue="chest">
              {MUSCLES.map((m) => (
                <option key={m} value={m}>
                  {t(`muscle.${m}` as TKey)}
                </option>
              ))}
            </select>
            <select name="equipment" className={selectClass} aria-label={t("w.equipment")} defaultValue="barbell">
              {EQUIPMENT.map((q) => (
                <option key={q} value={q}>
                  {t(`equip.${q}` as TKey)}
                </option>
              ))}
            </select>
          </div>
          <button className={buttonClass}>{t("w.add")}</button>
        </form>
      </details>

      <Card className="py-2">
        <ExerciseList exercises={exercises} />
      </Card>
    </>
  );
}
