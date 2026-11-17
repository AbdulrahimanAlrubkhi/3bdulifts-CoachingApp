"use client";

import { matchesSearch } from "@/lib/search";
import { useMemo, useState, type ReactNode } from "react";
import { usePrefs } from "@/lib/i18n/client";
import type { TKey } from "@/lib/i18n/dictionaries";
import { FOOD_CATEGORIES, kcal, type Food } from "@/lib/nutrition";
import { selectClass } from "./ExerciseList";
import { inputClass } from "./ui";

/** Searchable, filterable food list. `row` renders each food's clickable row. */
export function FoodList({
  foods,
  row,
  autoFocus = false,
}: {
  foods: Food[];
  row: (food: Food, body: ReactNode) => ReactNode;
  autoFocus?: boolean;
}) {
  const { t, name } = usePrefs();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");

  const shown = useMemo(() => {
    const q = query;
    return foods.filter(
      (f) => (!category || f.category === category) && matchesSearch(q, f.name_ar, f.name_en),
    );
  }, [foods, query, category]);

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("n.search")}
          aria-label={t("n.search")}
          autoFocus={autoFocus}
          className={`${inputClass} flex-[2]`}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${selectClass} h-11`} aria-label={t("n.category")}>
          <option value="">{t("n.all")}</option>
          {FOOD_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`cat.${c}` as TKey)}
            </option>
          ))}
        </select>
      </div>
      <ul className="mt-2">
        {shown.map((food) => (
          <li key={food.id} className="border-b border-line last:border-b-0">
            {row(
              food,
              <>
                <span className="min-w-0 truncate text-[15px]">
                  {name(food)}
                  {food.is_estimate && (
                    <span className="ms-1.5 text-xs text-muted" title={t("n.estimateHint")}>
                      ≈ {t("n.estimate")}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted">
                  <span className="num">{kcal(food.kcal_100g)}</span> {t("n.kcal")} / <span className="num">100</span>
                  {t("n.g")}
                </span>
              </>,
            )}
          </li>
        ))}
      </ul>
      {!shown.length && <p className="py-6 text-center text-sm text-muted">{t("w.noMatch")}</p>}
    </div>
  );
}

export const foodRowClass = "flex w-full items-center justify-between gap-3 py-3 text-start";

/** Full-screen food chooser (meal plan builder). */
export function FoodPicker({ foods, onPick, onClose }: { foods: Food[]; onPick: (food: Food) => void; onClose: () => void }) {
  const { t } = usePrefs();
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-bg" role="dialog" aria-modal="true" aria-label={t("n.addItem")}>
      <div className="mx-auto max-w-xl px-4 pb-10">
        <div className="sticky top-0 z-10 flex h-14 items-center justify-between bg-bg">
          <h2 className="text-base font-semibold">{t("n.addItem")}</h2>
          <button type="button" onClick={onClose} className="h-9 rounded-md border border-line px-3 text-sm text-muted hover:text-text">
            {t("w.close")}
          </button>
        </div>
        <FoodList
          foods={foods}
          autoFocus
          row={(food, body) => (
            <button type="button" className={foodRowClass} onClick={() => onPick(food)}>
              {body}
            </button>
          )}
        />
      </div>
    </div>
  );
}
