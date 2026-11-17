"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const axis = { tick: { fill: "var(--muted)", fontSize: 11 }, axisLine: false, tickLine: false } as const;
const tooltip = {
  contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, fontSize: 12, color: "var(--text)" },
  labelStyle: { color: "var(--muted)" },
  itemStyle: { color: "var(--text)" },
} as const;
const margin = { top: 8, right: 8, bottom: 0, left: -12 };

/** Rounds an axis maximum up to a clean step (5, 10, 25, 50, 100, 250, 500…). */
function niceMax(value: number) {
  if (value <= 0) return 10;
  const steps = [1, 2, 2.5, 5, 10];
  const mag = 10 ** Math.floor(Math.log10(value));
  const step = steps.find((s) => s * mag >= value / 4)! * mag;
  return Math.ceil((value * 1.05) / step) * step;
}

export type WeightPoint = { label: string; kg: number; avg: number };

/** Daily weigh-ins as dots, with the 7-day average as a line (spec #16). */
export function WeightChart({ points, unit, dailyLabel, avgLabel }: { points: WeightPoint[]; unit: string; dailyLabel: string; avgLabel: string }) {
  const values = points.flatMap((p) => [p.kg, p.avg]);
  const lo = Math.floor(Math.min(...values) - 1);
  const hi = Math.ceil(Math.max(...values) + 1);
  return (
    <figure>
      {/* two series, so a legend; the dot and line shapes carry identity, not colour alone */}
      <figcaption className="mb-2 flex gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-muted" aria-hidden="true" />
          {dailyLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-accent" aria-hidden="true" />
          {avgLabel}
        </span>
      </figcaption>
      <div dir="ltr" className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={margin}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="label" {...axis} minTickGap={28} />
            <YAxis {...axis} width={44} domain={[lo, hi]} allowDecimals={false} />
            <Tooltip {...tooltip} formatter={(v, name) => [`${v} ${unit}`, name === "kg" ? dailyLabel : avgLabel]} />
            <Line dataKey="kg" stroke="none" dot={{ r: 3, fill: "var(--muted)", strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={false} />
            <Line dataKey="avg" stroke="var(--accent)" strokeWidth={2} dot={false} type="monotone" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export type DayValue = { label: string; value: number | null };

/** One measure per day as bars, with the target as a dashed line. Used as small multiples for each macro. */
export function TargetBars({ title, points, target, unit, targetLabel, height = "h-36" }: { title: string; points: DayValue[]; target: number | null; unit: string; targetLabel: string; height?: string }) {
  const top = niceMax(Math.max(target ?? 0, ...points.map((p) => p.value ?? 0)));
  return (
    <figure>
      <figcaption className="mb-1 text-xs font-medium">
        {title} <span className="text-muted">({unit})</span>
      </figcaption>
      <div dir="ltr" className={height}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={margin}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={14} />
            <YAxis {...axis} width={44} domain={[0, top]} tickCount={3} />
            <Tooltip {...tooltip} cursor={{ fill: "var(--line)", opacity: 0.4 }} formatter={(v) => [`${Math.round(Number(v)).toLocaleString("en-US")} ${unit}`, title]} />
            {target != null && <ReferenceLine y={target} stroke="var(--muted)" strokeDasharray="4 4" label={{ value: targetLabel, position: "insideTopRight", fill: "var(--muted)", fontSize: 10 }} />}
            <Bar dataKey="value" fill="var(--accent)" radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

/** A single measurement over time (waist, chest…), one small chart each. */
export function MiniLine({ title, points, unit }: { title: string; points: DayValue[]; unit: string }) {
  const values = points.map((p) => p.value).filter((v): v is number => v != null);
  if (!values.length) return null;
  const last = values.at(-1)!;
  const change = last - values[0];
  return (
    <figure>
      <figcaption className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-medium">{title}</span>
        <span className="text-muted" dir="ltr">
          <span className="num text-text">{last}</span> {unit}
          {values.length > 1 && (
            <span className="num">
              {" "}
              ({change > 0 ? "+" : change < 0 ? "−" : "±"}
              {Math.abs(Math.round(change * 10) / 10)})
            </span>
          )}
        </span>
      </figcaption>
      <div dir="ltr" className="h-20">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
            <XAxis dataKey="label" hide />
            <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
            <Tooltip {...tooltip} formatter={(v) => [`${v} ${unit}`, title]} />
            <Line dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3, fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: 2 }} connectNulls isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
