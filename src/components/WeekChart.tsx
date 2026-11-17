"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type WeekPoint = { label: string; calories: number | null };

const axis = { tick: { fill: "var(--muted)", fontSize: 11 }, axisLine: false, tickLine: false } as const;

/** Calories per day, one bar each, with the target as a dashed line. Days with nothing logged have no bar. */
export function WeekChart({ points, target, title, unit, targetLabel }: { points: WeekPoint[]; target: number | null; title: string; unit: string; targetLabel: string }) {
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
            <YAxis {...axis} width={48} domain={[0, (max: number) => Math.max(max, target ?? 0) * 1.1]} tickFormatter={(v) => Math.round(v).toString()} />
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
