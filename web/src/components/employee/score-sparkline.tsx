"use client";

import { Area, AreaChart, CartesianGrid, Tooltip, XAxis } from "recharts";
import type { ScorePoint } from "@/contracts/employee";
import { ChartFrame, CHART_TOOLTIP_STYLE } from "./chart-frame";

function monthLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(new Date(iso));
}

export function ScoreSparkline({ history }: { history: ScorePoint[] }) {
  const data = history.map((point) => ({ ...point, label: monthLabel(point.asOf) }));
  const summary = data.map((point) => `${point.label}: ${point.value}`).join(". ");

  return (
    <figure className="min-w-0">
      <figcaption className="text-sm font-semibold leading-5">
        How has this score moved over six months?
      </figcaption>
      <p className="sr-only">{summary}</p>
      <ChartFrame heightClassName="mt-3 h-32">
        {(size) => (
          <AreaChart
            width={size.width}
            height={size.height}
            data={data}
            margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--color-ink-muted)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value) => [String(value ?? ""), "Score"]}
              labelFormatter={(label) => String(label)}
            />
            <Area
              type="monotone"
              dataKey="value"
              name="Score"
              stroke="var(--color-slate)"
              strokeWidth={2}
              fill="var(--color-slate)"
              fillOpacity={0.18}
              isAnimationActive={false}
            />
          </AreaChart>
        )}
      </ChartFrame>
    </figure>
  );
}
