"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type WeekPoint = { label: string; calories: number | null };

const axis = { tick: { fill: "var(--muted)", fontSize: 11 }, axisLine: false, tickLine: false } as const;

/** Calories per day, one bar each, with the target as a dashed line. Days with nothing logged have no bar. */
export function WeekChart({ points, target, title, unit, targetLabel }: { points: WeekPoint[]; target: number | null; title: string; unit: string; targetLabel: string }) {
  // round the top of the axis up to the next 500 so the ticks are clean numbers
  const top = Math.max(500, Math.ceil((Math.max(target ?? 0, ...points.map((p) => p.calories ?? 0)) * 1.08) / 500) * 500);
  return (
    <figure>
      <figcaption className="mb-2 text-sm font-medium">
        {title} ({unit})
      </figcaption>
      <div dir="ltr" className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="label" {...axis} interval={0} />
            <YAxis {...axis} width={48} domain={[0, top]} ticks={Array.from({ length: top / 500 + 1 }, (_, i) => i * 500).filter((_, i, a) => a.length <= 6 || i % 2 === 0)} />
            <Tooltip
              cursor={{ fill: "var(--line)", opacity: 0.4 }}
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, fontSize: 12, color: "var(--text)" }}
              labelStyle={{ color: "var(--muted)" }}
              itemStyle={{ color: "var(--text)" }}
              formatter={(v) => [`${Math.round(Number(v)).toLocaleString("en-US")} ${unit}`, title]}
            />
            {target != null && (
              <ReferenceLine
                y={target}
                stroke="var(--muted)"
                strokeDasharray="4 4"
                label={{ value: targetLabel, position: "insideTopRight", fill: "var(--muted)", fontSize: 11 }}
              />
            )}
            <Bar dataKey="calories" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
