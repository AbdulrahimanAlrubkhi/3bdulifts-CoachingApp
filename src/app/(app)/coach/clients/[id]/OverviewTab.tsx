import Link from "next/link";
import { EXPERIENCE, GOALS, ageOn } from "@/lib/clients";
import { loadClientMetrics } from "@/lib/coach-data";
import { todayISO } from "@/lib/dates";
import type { TKey } from "@/lib/i18n/dictionaries";
import { kcal, targetOn } from "@/lib/nutrition";
import { createClient } from "@/lib/supabase/server";
import { fmt, toDisplay } from "@/lib/units";
import { selectClass } from "@/components/ExerciseList";
import { FlagChip, NutritionPct, Pct, WeightAndTrend, lastCheckinText } from "@/components/MetricBits";
import { Card, Field, accentButtonClass, buttonClass, ghostButtonClass, inputClass } from "@/components/ui";
import { saveClientProfile } from "./actions";
import type { TabProps } from "./tab-props";

export async function OverviewTab({ clientId, client, name, t, unit }: TabProps) {
  const supabase = await createClient();
  const today = todayISO();
  const [{ metrics }, target] = await Promise.all([loadClientMetrics(supabase, clientId), targetOn(supabase, clientId, today)]);
  const m = metrics.get(clientId)!;
  const answers = client.onboarding ?? {};
  const age = ageOn(client.birth_date, today);

  const tile = (label: string, value: React.ReactNode, warn = false) => (
    <div>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className={`mt-0.5 text-sm ${warn ? "text-danger" : ""}`}>{value}</dd>
    </div>
  );

  return (
    <div className="space-y-3">
      <Card>
        {m.flags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {m.flags.map((f) => (
              <FlagChip key={f} flag={f} t={t} />
            ))}
          </div>
        )}
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tile(t("cc.lastCheckin"), lastCheckinText(m, t), m.flags.includes("missed"))}
          {tile(t("cc.avg7"), <WeightAndTrend m={m} unit={unit} t={t} />)}
          {tile(t("cc.workouts"), <Pct value={m.workoutPct} />, m.flags.includes("lowWorkout"))}
          {tile(t("cc.nutrition"), <NutritionPct m={m} t={t} />, m.flags.includes("lowNutrition"))}
        </dl>
      </Card>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <Link href={`/coach/clients/${clientId}/targets`}>
          <Card className="h-full p-3">
            <span className="block font-medium">{t("n.targets")}</span>
            <span className="mt-0.5 block text-xs text-muted">
              {target ? (
                <>
                  {t(`phase.${target.phase}`)} · <span className="num">{kcal(target.calories)}</span> {t("n.kcal")}
                </>
              ) : (
                "—"
              )}
            </span>
          </Card>
        </Link>
        <Link href={`/coach/library/meal-plans?client=${clientId}`}>
          <Card className="h-full p-3 font-medium">{t("n.plans")}</Card>
        </Link>
      </div>

      <Card>
        <h2 className="mb-2 text-sm font-medium">{t("ex.title")}</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          <a href={`/report/${clientId}`} target="_blank" rel="noreferrer" className={accentButtonClass + " inline-flex items-center"}>
            {t("ex.report")}
          </a>
          {(
            [
              ["daily", "ex.daily"],
              ["weekly", "ex.weekly"],
              ["workouts", "ex.workouts"],
              ["food", "ex.food"],
              ["targets", "ex.targets"],
            ] as const
          ).map(([key, label]) => (
            // plain links: the browser downloads the CSV file
            <a key={key} href={`/coach/clients/${clientId}/export/${key}`} className={ghostButtonClass + " inline-flex items-center"}>
              {t(label)} · CSV
            </a>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <Link href={`/coach/business/subscriptions?client=${clientId}`}>
          <Card className="h-full p-3 font-medium">{t("sub.title")}</Card>
        </Link>
        <Link href={`/coach/business/wins/new?client=${clientId}`}>
          <Card className="h-full p-3 font-medium">{t("win.mark")}</Card>
        </Link>
      </div>

      {Object.values(answers).some(Boolean) && (
        <Card>
          <h2 className="mb-2 text-sm font-medium">{t("cc.answers")}</h2>
          <dl className="space-y-2 text-sm">
            {(
              [
                ["goal_detail", "ob.goalDetail"],
                ["why_now", "ob.why"],
                ["place", "ob.place"],
                ["dislikes", "ob.dislikes"],
                ["meals_per_day", "ob.meals"],
              ] as const
            ).map(([key, label]) =>
              answers[key] ? (
                <div key={key}>
                  <dt className="text-xs text-muted">{t(label)}</dt>
                  <dd className="whitespace-pre-wrap">{key === "place" ? t(`place.${answers[key]}` as TKey) : answers[key]}</dd>
                </div>
              ) : null,
            )}
          </dl>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-medium">{t("cc.profile")}</h2>
        {/* keyed by the stored values so the form shows what was saved */}
        <form key={JSON.stringify(client) + name} action={saveClientProfile} className="space-y-3">
          <input type="hidden" name="client_id" value={clientId} />
          <Field label={t("auth.name")}>
            <input name="full_name" defaultValue={name} className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("ob.whatsapp")}>
              <input name="whatsapp" dir="ltr" defaultValue={client.whatsapp ?? ""} className={`${inputClass} num`} />
            </Field>
            <Field label={t("ob.instagram")}>
              <input name="instagram" dir="ltr" defaultValue={client.instagram ?? ""} className={inputClass} />
            </Field>
          </div>
          <Field label={t("auth.email")}>
            <input name="email" type="email" dir="ltr" defaultValue={client.email ?? ""} className={inputClass} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label={`${t("ob.birthDate")}${age != null ? ` (${age})` : ""}`}>
              <input name="birth_date" type="date" defaultValue={client.birth_date ?? ""} className={`${inputClass} num px-1`} />
            </Field>
            <Field label={t("ob.height")}>
              <input name="height_cm" inputMode="decimal" defaultValue={client.height_cm ?? ""} className={`${inputClass} num text-center`} />
            </Field>
            <Field label={`${t("cc.startWeight")} (${unit})`}>
              <input
                name="starting_weight"
                inputMode="decimal"
                defaultValue={client.starting_weight_kg == null ? "" : fmt(toDisplay(Number(client.starting_weight_kg), unit))}
                className={`${inputClass} num text-center`}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("ob.goal")}>
              <select name="goal" defaultValue={client.goal ?? ""} className={`${selectClass} h-11 w-full`}>
                <option value="">—</option>
                {GOALS.map((g) => (
                  <option key={g} value={g}>
                    {t(`goal.${g}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("ob.experience")}>
              <select name="experience" defaultValue={client.experience ?? ""} className={`${selectClass} h-11 w-full`}>
                <option value="">—</option>
                {EXPERIENCE.map((e) => (
                  <option key={e} value={e}>
                    {t(`exp.${e}`)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("cc.trainingDays")}>
              <input name="training_days_per_week" inputMode="numeric" defaultValue={client.training_days_per_week ?? ""} className={`${inputClass} num text-center`} />
            </Field>
            <Field label={t("cc.startDate")}>
              <input name="start_date" type="date" defaultValue={client.start_date ?? ""} className={`${inputClass} num px-1`} />
            </Field>
          </div>
          <Field label={t("ob.availability")}>
            <input name="availability" defaultValue={client.availability ?? ""} className={inputClass} />
          </Field>
          <Field label={t("ob.injuries")}>
            <textarea name="injuries" rows={2} defaultValue={client.injuries ?? ""} className={`${inputClass} h-auto py-2`} />
          </Field>
          <button className={buttonClass}>{t("w.save")}</button>
        </form>
      </Card>
    </div>
  );
}
