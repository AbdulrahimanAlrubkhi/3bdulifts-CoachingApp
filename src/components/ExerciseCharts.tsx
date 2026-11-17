"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ChartPoint = { label: string; est1rm: number; volume: number };

const axis = { tick: { fill: "var(--muted)", fontSize: 11 }, axisLine: false, tickLine: false } as const;

const tooltip = {
  contentStyle: {
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: 6,
    fontSize: 12,
    color: "var(--text)",
  },
  labelStyle: { color: "var(--muted)" },
  itemStyle: { color: "var(--text)" },
} as const;

function Frame({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <figure>
      <figcaption className="mb-2 text-sm font-medium">{title}</figcaption>
      {/* charts always read left to right (time), also in Arabic */}
      <div dir="ltr" className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

/** Two separate single-series charts: best estimated 1RM per session, and total volume per session. */
export function ExerciseCharts({
  points,
  unit,
  est1rmTitle,
  volumeTitle,
}: {
  points: ChartPoint[];
  unit: string;
  est1rmTitle: string;
  volumeTitle: string;
}) {
  const margin = { top: 8, right: 8, bottom: 0, left: -12 };
  return (
    <div className="space-y-6">
      <Frame title={`${est1rmTitle} (${unit})`}>
        <LineChart data={points} margin={margin}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="label" {...axis} minTickGap={24} />
          <YAxis {...axis} domain={["auto", "auto"]} width={48} />
          <Tooltip {...tooltip} cursor={{ stroke: "var(--muted)", strokeWidth: 1 }} formatter={(v) => [`${v} ${unit}`, est1rmTitle]} />
          <Line
            type="monotone"
            dataKey="est1rm"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={{ r: 4, fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: 2 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </Frame>
      <Frame title={`${volumeTitle} (${unit})`}>
        <BarChart data={points} margin={margin}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="label" {...axis} minTickGap={24} />
          <YAxis {...axis} width={48} />
          <Tooltip {...tooltip} cursor={{ fill: "var(--line)", opacity: 0.4 }} formatter={(v) => [`${v} ${unit}`, volumeTitle]} />
          <Bar dataKey="volume" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </Frame>
    </div>
  );
}
