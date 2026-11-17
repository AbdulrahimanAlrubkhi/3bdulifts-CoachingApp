import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import type { TKey } from "@/lib/i18n/dictionaries";
import { FOOD_CATEGORIES, FOOD_COLUMNS, normalizeFood, type Food } from "@/lib/nutrition";
import { createClient } from "@/lib/supabase/server";
import { selectClass } from "@/components/ExerciseList";
import { Card, Field, PageTitle, buttonClass, ghostButtonClass, inputClass } from "@/components/ui";
import { deleteFood, saveFood } from "../../../nutrition-actions";

// "/coach/library/foods/new" creates; any other id edits that food.
export default async function FoodFormPage({ params, searchParams }: PageProps<"/coach/library/foods/[id]">) {
  const { id } = await params;
  const { inuse } = await searchParams;
  await requireCoach();
  const { t } = await getT();

  let food: Food | null = null;
  if (id !== "new") {
    const supabase = await createClient();
    const { data } = await supabase.from("foods").select(FOOD_COLUMNS).eq("id", id).maybeSingle();
    if (!data) notFound();
    food = normalizeFood(data as Food);
  }

  const numField = (name: keyof Food, label: string, required = false) => (
    <Field label={label}>
      <input
        name={name}
        inputMode="decimal"
        required={required}
        defaultValue={food?.[name] == null ? "" : String(food[name])}
        className={`${inputClass} num text-center`}
      />
    </Field>
  );

  return (
    <>
      <PageTitle>{food ? t("n.editFood") : t("n.newFood")}</PageTitle>
      {inuse && <p className="mb-3 text-sm text-danger">{t("n.inUse")}</p>}
      <Card>
        <form action={saveFood} className="space-y-3">
          {food && <input type="hidden" name="id" value={food.id} />}
          <Field label={t("w.nameAr")}>
            <input name="name_ar" defaultValue={food?.name_ar} dir="rtl" className={inputClass} />
          </Field>
          <Field label={t("w.nameEn")}>
            <input name="name_en" defaultValue={food?.name_en} dir="ltr" className={inputClass} />
          </Field>
          <Field label={t("n.category")}>
            <select name="category" defaultValue={food?.category ?? "dishes"} className={`${selectClass} h-11 w-full`}>
              {FOOD_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`cat.${c}` as TKey)}
                </option>
              ))}
            </select>
          </Field>
          <p className="pt-1 text-sm text-muted">{t("n.per100")}</p>
          <div className="grid grid-cols-2 gap-3">
            {numField("kcal_100g", `${t("n.calories")} (${t("n.kcal")})`, true)}
            {numField("protein_100g", `${t("n.protein")} (${t("n.g")})`)}
            {numField("carbs_100g", `${t("n.carbs")} (${t("n.g")})`)}
            {numField("fat_100g", `${t("n.fat")} (${t("n.g")})`)}
            {numField("fiber_100g", `${t("n.fiber")} (${t("n.g")})`)}
            {numField("serving_g", t("n.servingG"))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("n.servingAr")}>
              <input name="serving_ar" defaultValue={food?.serving_ar ?? ""} dir="rtl" className={inputClass} />
            </Field>
            <Field label={t("n.servingEn")}>
              <input name="serving_en" defaultValue={food?.serving_en ?? ""} dir="ltr" className={inputClass} />
            </Field>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="is_estimate" defaultChecked={food?.is_estimate ?? false} className="mt-0.5 h-5 w-5 shrink-0 accent-(--accent)" />
            <span>
              ≈ {t("n.estimate")}
              <span className="block text-xs text-muted">{t("n.estimateHint")}</span>
            </span>
          </label>
          <button className={buttonClass}>{t("w.save")}</button>
        </form>
      </Card>
      {food && (
        <form action={deleteFood} className="mt-6">
          <input type="hidden" name="id" value={food.id} />
          <button className={`${ghostButtonClass} text-danger`}>{t("w.delete")}</button>
        </form>
      )}
    </>
  );
}
