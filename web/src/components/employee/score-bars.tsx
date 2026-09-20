"use client";

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import type { ScorePoint } from "@/contracts/employee";
import { ChartFrame, CHART_TOOLTIP_STYLE } from "./chart-frame";

function monthLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(new Date(iso));
}

export function ScoreBars({ history }: { history: ScorePoint[] }) {
  const data = history.map((point) => ({ ...point, label: monthLabel(point.asOf) }));
  const summary = data.map((point) => `${point.label}: ${point.value}`).join(". ");

  return (
    <figure>
      <figcaption className="text-base font-semibold">How did the score move, month by month?</figcaption>
      <p className="sr-only">{summary}</p>
      <ChartFrame heightClassName="mt-4 h-48">
        {(size) => (
          <BarChart width={size.width} height={size.height} data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--color-ink-muted)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "var(--color-ink-muted)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value) => [String(value ?? ""), "Score"]}
              labelFormatter={(label) => String(label)}
            />
            <Bar dataKey="value" name="Score" fill="var(--color-slate)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        )}
      </ChartFrame>
    </figure>
  );
}
