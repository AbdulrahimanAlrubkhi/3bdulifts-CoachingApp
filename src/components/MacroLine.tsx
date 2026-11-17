"use client";

import { usePrefs } from "@/lib/i18n/client";
import { grams as fmtGrams, kcal, type Macros } from "@/lib/nutrition";

/** "520 kcal · P 42 · C 55 · F 14" */
export function MacroLine({ m, className = "" }: { m: Macros; className?: string }) {
  const { t } = usePrefs();
  return (
    <span className={`text-xs text-muted ${className}`}>
      <span className="num text-text">{kcal(m.calories)}</span> {t("n.kcal")} · {t("n.protein")}{" "}
      <span className="num">{fmtGrams(m.protein_g)}</span> · {t("n.carbs")} <span className="num">{fmtGrams(m.carbs_g)}</span> ·{" "}
      {t("n.fat")} <span className="num">{fmtGrams(m.fat_g)}</span>
    </span>
  );
}
