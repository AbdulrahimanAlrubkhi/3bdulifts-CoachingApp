"use client";

import { useState } from "react";
import { usePrefs } from "@/lib/i18n/client";
import { PHASES, kcal, type Target } from "@/lib/nutrition";
import { Field, buttonClass, inputClass } from "@/components/ui";
import { selectClass } from "@/components/ExerciseList";
import { saveTarget } from "../../../nutrition-actions";

/** Target form. Starts from the current target so a phase change only means editing what changes. */
export function TargetForm({ clientId, current, today }: { clientId: string; current: Target | null; today: string }) {
  const { t } = usePrefs();
  const [values, setValues] = useState({
    calories: String(current?.calories ?? ""),
    protein_g: String(current?.protein_g ?? ""),
    carbs_g: String(current?.carbs_g ?? ""),
    fat_g: String(current?.fat_g ?? ""),
    fiber_g: String(current?.fiber_g ?? ""),
    water_ml: String(current?.water_ml ?? ""),
  });
  const n = (s: string) => parseFloat(s) || 0;
  const fromMacros = n(values.protein_g) * 4 + n(values.carbs_g) * 4 + n(values.fat_g) * 9;
  const gap = n(values.calories) - fromMacros;

  const input = (key: keyof typeof values, label: string, required = false) => (
    <Field label={label}>
      <input
        name={key}
        inputMode="numeric"
        required={required}
        value={values[key]}
        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
        className={`${inputClass} num text-center`}
      />
    </Field>
  );

  return (
    <form action={saveTarget} className="space-y-3">
      <input type="hidden" name="client_id" value={clientId} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("n.phase")}>
          <select name="phase" defaultValue={current?.phase ?? "cut"} className={`${selectClass} h-11 w-full`}>
            {PHASES.map((p) => (
              <option key={p} value={p}>
                {t(`phase.${p}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("n.from")}>
          <input name="effective_from" type="date" defaultValue={today} required className={`${inputClass} num`} />
        </Field>
      </div>
      {input("calories", `${t("n.calories")} (${t("n.kcal")})`, true)}
      <div className="grid grid-cols-3 gap-3">
        {input("protein_g", `${t("n.protein")} (${t("n.g")})`, true)}
        {input("carbs_g", `${t("n.carbs")} (${t("n.g")})`, true)}
        {input("fat_g", `${t("n.fat")} (${t("n.g")})`, true)}
      </div>
      <p className="text-xs text-muted" role="status">
        {t("n.macroKcal")} <span className="num text-text">{kcal(fromMacros)}</span> {t("n.kcal")}
        {fromMacros > 0 && Math.abs(gap) >= 50 && (
          <span className="text-danger">
            {" "}
            (<span className="num">{gap > 0 ? "−" : "+"}{kcal(Math.abs(gap))}</span>)
          </span>
        )}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {input("fiber_g", `${t("n.fiber")} (${t("n.g")})`)}
        {input("water_ml", `${t("n.water")} (${t("n.ml")})`)}
      </div>
      <Field label={t("n.note")}>
        <input name="note" className={inputClass} />
      </Field>
      <button className={buttonClass}>{t("n.saveTarget")}</button>
    </form>
  );
}
