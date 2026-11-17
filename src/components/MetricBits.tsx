import type { ClientMetrics, Flag } from "@/lib/coach-metrics";
import type { TKey } from "@/lib/i18n/dictionaries";
import { fmt, toDisplay, type Unit } from "@/lib/units";

type T = (key: TKey) => string;

/** A flag as a small outlined chip. Text plus outline, never colour alone. */
export function FlagChip({ flag, t }: { flag: Flag; t: T }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-danger/60 px-1.5 py-0.5 text-[11px] text-danger">
      <span aria-hidden="true">!</span>
      {t(`cc.flag.${flag}` as TKey)}
    </span>
  );
}

export function lastCheckinText(m: ClientMetrics, t: T) {
  if (m.daysSinceCheckin == null) return t("cc.never");
  if (m.daysSinceCheckin === 0) return t("n.today");
  if (m.daysSinceCheckin === 1) return t("cc.yesterday");
  return `${m.daysSinceCheckin} ${t("cc.daysAgo")}`;
}

/** "82.4 kg" and "−0.4 kg/wk", in the viewer's unit. */
export function WeightAndTrend({ m, unit, t }: { m: ClientMetrics; unit: Unit; t: T }) {
  if (m.avg7 == null) return <span className="text-muted">–</span>;
  const trend = m.trendKgPerWeek == null ? null : toDisplay(m.trendKgPerWeek, unit)!;
  return (
    <span>
      <span className="num">{fmt(toDisplay(m.avg7, unit))}</span> <span className="text-xs text-muted">{unit}</span>
      {trend != null && (
        <span className="block text-xs text-muted">
          <span className="num">
            {trend > 0 ? "+" : trend < 0 ? "−" : "±"}
            {fmt(Math.abs(trend))}
          </span>{" "}
          {unit}
          {t("cc.perWeek")}
        </span>
      )}
    </span>
  );
}

export function Pct({ value }: { value: number | null }) {
  return value == null ? <span className="text-muted">–</span> : <span className="num">{value}%</span>;
}

/** Nutrition adherence with how much it rests on: "80%" over "4/7 days logged". */
export function NutritionPct({ m, t }: { m: ClientMetrics; t: T }) {
  return (
    <span>
      <Pct value={m.nutritionPct} />
      {m.targetDays > 0 && (
        <span className="block text-xs text-muted">
          <span className="num">{`${m.loggedDays}/${m.targetDays}`}</span> {t("cc.loggedDays")}
        </span>
      )}
    </span>
  );
}
