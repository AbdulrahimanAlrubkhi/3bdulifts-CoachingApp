"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePrefs } from "@/lib/i18n/client";
import { MEALS, forGrams, type Food, type Meal } from "@/lib/nutrition";
import { todayISO } from "@/lib/dates";
import { FoodList, foodRowClass } from "@/components/FoodList";
import { MacroLine } from "@/components/MacroLine";
import { Card, Field, buttonClass, ghostButtonClass, inputClass } from "@/components/ui";
import { addFoodLog, addQuickLog, toggleSavedFood } from "../actions";

type Tab = "all" | "saved" | "quick";

export function AddFood({ foods, savedIds, initialMeal, date }: { foods: Food[]; savedIds: string[]; initialMeal: Meal; date: string }) {
  const { t, name } = usePrefs();
  const router = useRouter();
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [tab, setTab] = useState<Tab>(savedIds.length ? "saved" : "all");
  const [saved, setSaved] = useState(() => new Set(savedIds));
  const [chosen, setChosen] = useState<Food | null>(null);
  const [amount, setAmount] = useState("");
  const [quick, setQuick] = useState({ name: "", calories: "", protein_g: "", carbs_g: "", fat_g: "" });
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const back = () => router.push(date === todayISO() ? "/nutrition" : `/nutrition?date=${date}`);
  const done = (result: { ok: boolean }) => (result.ok ? back() : setFailed(true));

  const choose = (food: Food) => {
    setChosen(food);
    setAmount(String(food.serving_g ?? 100));
    setFailed(false);
  };

  const star = (food: Food) => {
    const on = !saved.has(food.id);
    startTransition(async () => {
      const result = await toggleSavedFood(food.id, on);
      if (!result.ok) return;
      setSaved((set) => {
        const next = new Set(set);
        if (on) next.add(food.id);
        else next.delete(food.id);
        return next;
      });
    });
  };

  const tabClass = (on: boolean) =>
    `h-9 flex-1 rounded-md text-sm transition-colors ${on ? "bg-surface text-text border border-line" : "text-muted hover:text-text"}`;
  const amountG = parseFloat(amount) || 0;

  const row = (food: Food, body: React.ReactNode) => (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => choose(food)} className={`${foodRowClass} min-w-0 flex-1`}>
        {body}
      </button>
      <button
        type="button"
        onClick={() => star(food)}
        aria-pressed={saved.has(food.id)}
        aria-label={saved.has(food.id) ? t("n.unsave") : t("n.save")}
        className={`h-9 w-9 shrink-0 text-lg ${saved.has(food.id) ? "text-accent" : "text-muted"}`}
      >
        {saved.has(food.id) ? "★" : "☆"}
      </button>
    </div>
  );

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{t("n.addFood")}</h1>
        <select
          value={meal}
          onChange={(e) => setMeal(e.target.value as Meal)}
          aria-label={t("n.meal")}
          className="h-9 rounded-md border border-line bg-surface px-2 text-sm"
        >
          {MEALS.map((m) => (
            <option key={m} value={m}>
              {t(`meal.${m}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-3 flex gap-1 rounded-lg bg-bg p-1" role="tablist">
        {(
          [
            ["saved", "n.saved"],
            ["all", "n.all"],
            ["quick", "n.quick"],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={tabClass(tab === key)}>
            {t(label)}
          </button>
        ))}
      </div>

      {failed && <p className="mb-3 text-sm text-danger" role="alert">{t("w.saveFailed")}</p>}

      {tab === "quick" ? (
        <Card>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const n = (s: string) => parseFloat(s) || 0;
              startTransition(async () =>
                done(
                  await addQuickLog({
                    name: quick.name,
                    calories: n(quick.calories),
                    protein_g: n(quick.protein_g),
                    carbs_g: n(quick.carbs_g),
                    fat_g: n(quick.fat_g),
                    meal,
                    date,
                  }),
                ),
              );
            }}
          >
            <Field label={t("n.quickName")}>
              <input value={quick.name} onChange={(e) => setQuick({ ...quick, name: e.target.value })} className={inputClass} />
            </Field>
            <Field label={`${t("n.calories")} (${t("n.kcal")})`}>
              <input
                inputMode="decimal"
                required
                value={quick.calories}
                onChange={(e) => setQuick({ ...quick, calories: e.target.value })}
                className={`${inputClass} num text-center`}
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  ["protein_g", "n.protein"],
                  ["carbs_g", "n.carbs"],
                  ["fat_g", "n.fat"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={`${t(label)} (${t("n.g")})`}>
                  <input
                    inputMode="decimal"
                    value={quick[key]}
                    onChange={(e) => setQuick({ ...quick, [key]: e.target.value })}
                    className={`${inputClass} num text-center`}
                  />
                </Field>
              ))}
            </div>
            <button disabled={pending} className={buttonClass}>
              {t("n.add")}
            </button>
          </form>
        </Card>
      ) : (
        <Card className="py-2">
          {tab === "saved" && !saved.size ? (
            <p className="py-4 text-center text-sm text-muted">{t("n.noSaved")}</p>
          ) : (
            <FoodList foods={tab === "saved" ? foods.filter((f) => saved.has(f.id)) : foods} row={row} />
          )}
        </Card>
      )}

      {chosen && (
        // amount sheet, pinned above the tab bar
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]" role="dialog" aria-label={name(chosen)}>
          <div className="mx-auto max-w-xl space-y-3 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">{name(chosen)}</h2>
                <MacroLine m={forGrams(chosen, amountG)} />
              </div>
              <button type="button" onClick={() => setChosen(null)} className={ghostButtonClass}>
                {t("w.close")}
              </button>
            </div>
            <div className="flex items-end gap-2">
              <Field label={t("n.grams")}>
                <input
                  inputMode="decimal"
                  autoFocus
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={`${inputClass} num w-28 text-center`}
                />
              </Field>
              {chosen.serving_g && (
                <button
                  type="button"
                  onClick={() => setAmount(String(chosen.serving_g))}
                  className={`${ghostButtonClass} h-11`}
                >
                  1 {(name({ name_ar: chosen.serving_ar ?? "", name_en: chosen.serving_en ?? "" }) || t("n.serving"))} ·{" "}
                  <span className="num">{chosen.serving_g}</span>
                  {t("n.g")}
                </button>
              )}
            </div>
            <button
              type="button"
              disabled={pending || amountG <= 0}
              onClick={() => startTransition(async () => done(await addFoodLog({ food_id: chosen.id, grams: amountG, meal, date })))}
              className={buttonClass}
            >
              {t("n.add")} · {t(`meal.${meal}`)}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
