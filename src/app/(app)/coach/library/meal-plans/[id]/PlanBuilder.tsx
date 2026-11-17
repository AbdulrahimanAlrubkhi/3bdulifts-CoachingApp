"use client";

import { useMemo, useState, useTransition } from "react";
import { usePrefs } from "@/lib/i18n/client";
import { MEALS, forGrams, kcal, sum, type Food, type Meal } from "@/lib/nutrition";
import { MacroLine } from "@/components/MacroLine";
import { selectClass } from "@/components/ExerciseList";
import { FoodPicker } from "@/components/FoodList";
import { Card, buttonClass, ghostButtonClass, inputClass } from "@/components/ui";
import { deleteMealPlan, duplicateMealPlan, saveMealPlan } from "../../../nutrition-actions";

export type BuilderItem = { key: string; food_id: string; grams: string };
export type BuilderOption = { key: string; id: string | null; meal: Meal; name_ar: string; name_en: string; items: BuilderItem[] };

type Props = {
  plan: { id: string; title: string; notes: string; client_id: string | null; active: boolean };
  initialOptions: BuilderOption[];
  foods: Food[];
  clients: { id: string; full_name: string }[];
};

export function PlanBuilder({ plan, initialOptions, foods, clients }: Props) {
  const { t, name } = usePrefs();
  const [title, setTitle] = useState(plan.title);
  const [notes, setNotes] = useState(plan.notes);
  const [clientId, setClientId] = useState(plan.client_id ?? "");
  const [active, setActive] = useState(plan.active);
  const [options, setOptions] = useState(initialOptions);
  const [picking, setPicking] = useState<string | null>(null); // option key receiving a food
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");
  const [pending, startTransition] = useTransition();

  const foodById = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const totals = (option: BuilderOption) =>
    sum(
      option.items.map((i) => {
        const food = foodById.get(i.food_id);
        return food ? forGrams(food, parseFloat(i.grams) || 0) : {};
      }),
    );

  const edit = (change: () => void) => {
    setStatus("idle");
    change();
  };
  const patchOption = (key: string, change: Partial<BuilderOption>) =>
    edit(() => setOptions((list) => list.map((o) => (o.key === key ? { ...o, ...change } : o))));
  const patchItems = (key: string, update: (items: BuilderItem[]) => BuilderItem[]) =>
    edit(() => setOptions((list) => list.map((o) => (o.key === key ? { ...o, items: update(o.items) } : o))));

  const save = () =>
    startTransition(async () => {
      const result = await saveMealPlan(plan.id, {
        title,
        notes,
        client_id: clientId || null,
        active,
        options: options.map((o) => ({
          id: o.id,
          meal: o.meal,
          name_ar: o.name_ar,
          name_en: o.name_en,
          items: o.items.map((i) => ({ food_id: i.food_id, grams: parseFloat(i.grams) || 0 })),
        })),
      });
      setStatus(result.ok ? "saved" : "failed");
      // new options now exist in the database; keep their ids so the next save updates them
      if (result.ok) setOptions((list) => list.map((o, i) => ({ ...o, id: result.ids[i] ?? o.id })));
    });

  const cell = "h-9 w-16 rounded-md border border-line bg-bg px-1 text-center text-sm outline-none focus:border-accent";

  return (
    <div className="space-y-4">
      <input
        value={title}
        onChange={(e) => edit(() => setTitle(e.target.value))}
        aria-label={t("n.planTitle")}
        className={`${inputClass} text-base font-medium`}
      />
      <div className="flex gap-2">
        <select
          value={clientId}
          onChange={(e) => edit(() => setClientId(e.target.value))}
          className={`${selectClass} h-11`}
          aria-label={t("n.client")}
        >
          <option value="">—</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name || "—"}
            </option>
          ))}
        </select>
        <label className="flex h-11 items-center gap-2 rounded-md border border-line px-3 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => edit(() => setActive(e.target.checked))} className="h-4 w-4 accent-(--accent)" />
          {t("n.active")}
        </label>
      </div>
      <textarea
        value={notes}
        onChange={(e) => edit(() => setNotes(e.target.value))}
        placeholder={t("w.notes")}
        aria-label={t("w.notes")}
        rows={2}
        className={`${inputClass} h-auto py-2`}
      />

      {MEALS.map((meal) => {
        const mealOptions = options.filter((o) => o.meal === meal);
        return (
          <section key={meal}>
            <h2 className="mb-2 text-sm font-medium text-muted">{t(`meal.${meal}`)}</h2>
            <div className="space-y-2">
              {mealOptions.map((option) => (
                <Card key={option.key} className="p-3">
                  <div className="flex gap-2">
                    <input
                      value={option.name_ar}
                      onChange={(e) => patchOption(option.key, { name_ar: e.target.value })}
                      placeholder={t("n.optionName")}
                      aria-label={t("n.optionName")}
                      className={`${inputClass} h-10`}
                    />
                    <button
                      type="button"
                      aria-label={t("w.remove")}
                      onClick={() => edit(() => setOptions((list) => list.filter((o) => o.key !== option.key)))}
                      className="h-10 w-10 shrink-0 rounded-md border border-line text-danger"
                    >
                      ×
                    </button>
                  </div>
                  <input
                    value={option.name_en}
                    onChange={(e) => patchOption(option.key, { name_en: e.target.value })}
                    placeholder={t("n.optionNameEn")}
                    aria-label={t("n.optionNameEn")}
                    dir="ltr"
                    className={`${inputClass} mt-2 h-9 text-sm`}
                  />
                  <ul className="mt-2">
                    {option.items.map((item) => {
                      const food = foodById.get(item.food_id);
                      const m = food ? forGrams(food, parseFloat(item.grams) || 0) : null;
                      return (
                        <li key={item.key} className="flex items-center gap-2 border-b border-line py-2 last:border-b-0">
                          <span className="min-w-0 flex-1 truncate text-sm">{food ? name(food) : "—"}</span>
                          <span className="num w-14 shrink-0 text-end text-xs text-muted">{m ? kcal(m.calories) : "–"}</span>
                          <input
                            inputMode="decimal"
                            value={item.grams}
                            aria-label={t("n.grams")}
                            onChange={(e) =>
                              patchItems(option.key, (items) => items.map((i) => (i.key === item.key ? { ...i, grams: e.target.value } : i)))
                            }
                            className={`${cell} num`}
                          />
                          <span className="text-xs text-muted">{t("n.g")}</span>
                          <button
                            type="button"
                            aria-label={t("w.remove")}
                            onClick={() => patchItems(option.key, (items) => items.filter((i) => i.key !== item.key))}
                            className="h-8 w-8 shrink-0 rounded-md text-danger"
                          >
                            ×
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <MacroLine m={totals(option)} />
                    <button type="button" onClick={() => setPicking(option.key)} className={`${ghostButtonClass} h-8 shrink-0 text-xs`}>
                      + {t("n.addItem")}
                    </button>
                  </div>
                </Card>
              ))}
              <button
                type="button"
                onClick={() =>
                  edit(() =>
                    setOptions((list) => [
                      ...list,
                      { key: crypto.randomUUID(), id: null, meal, name_ar: "", name_en: "", items: [] },
                    ]),
                  )
                }
                className={`${ghostButtonClass} w-full`}
              >
                + {t("n.addOption")}
              </button>
            </div>
          </section>
        );
      })}

      <div>
        <button type="button" onClick={save} disabled={pending} className={buttonClass}>
          {t("w.save")}
        </button>
        <p className="mt-2 h-5 text-center text-sm" role="status">
          {status === "saved" && <span className="text-accent">{t("w.saved")}</span>}
          {status === "failed" && <span className="text-danger">{t("w.saveFailed")}</span>}
        </p>
      </div>

      <div className="flex gap-2">
        <form action={duplicateMealPlan}>
          <input type="hidden" name="id" value={plan.id} />
          <button className={ghostButtonClass}>{t("n.duplicate")}</button>
        </form>
        <form
          action={deleteMealPlan}
          onSubmit={(e) => {
            if (!window.confirm(t("w.confirmDelete"))) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={plan.id} />
          <button className={`${ghostButtonClass} text-danger`}>{t("w.delete")}</button>
        </form>
      </div>

      {picking && (
        <FoodPicker
          foods={foods}
          onClose={() => setPicking(null)}
          onPick={(food) => {
            patchItems(picking, (items) => [
              ...items,
              { key: crypto.randomUUID(), food_id: food.id, grams: String(food.serving_g ?? 100) },
            ]);
            setPicking(null);
          }}
        />
      )}
    </div>
  );
}

