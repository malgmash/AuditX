"use client";

import { Cell, Pie, PieChart, Tooltip } from "recharts";
import { formatCents } from "@/lib/money";
import { ChartFrame, CHART_TOOLTIP_STYLE } from "./chart-frame";

export type DonutSlice = {
  label: string;
  value: number;
  fill: string;
};

export function DonutChart({
  title,
  slices,
  centerLabel,
  centerValue,
  unit = "count",
}: {
  title: string;
  slices: DonutSlice[];
  centerLabel: string;
  centerValue: string;
  unit?: "count" | "usd";
}) {
  const formatValue = (value: number) => (unit === "usd" ? formatCents(value) : String(value));
  const visible = slices.filter((slice) => slice.value > 0);
  const summary = slices.map((slice) => `${slice.label}: ${formatValue(slice.value)}`).join(". ");

  return (
    <figure>
      <figcaption className="text-base font-semibold">{title}</figcaption>
      <p className="sr-only">{summary}</p>
      {visible.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">Nothing to split yet.</p>
      ) : (
        <div className="relative mt-2">
          <ChartFrame heightClassName="h-48">
            {(size) => (
              <PieChart width={size.width} height={size.height}>
                <Pie
                  data={visible}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={2}
                  stroke="var(--color-surface)"
                  isAnimationActive={false}
                >
                  {visible.map((slice) => (
                    <Cell key={slice.label} fill={slice.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(value, name) => [
                    unit === "usd" ? formatCents(Number(value ?? 0)) : String(value ?? ""),
                    String(name),
                  ]}
                />
              </PieChart>
            )}
          </ChartFrame>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs text-ink-muted">{centerLabel}</span>
            <span className="text-base font-semibold tabular-nums">{centerValue}</span>
          </div>
        </div>
      )}
      <ul className="mt-2 grid gap-1">
        {slices.map((slice) => (
          <li key={slice.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-control" style={{ background: slice.fill }} aria-hidden="true" />
              {slice.label}
            </span>
            <span className="font-semibold tabular-nums">{formatValue(slice.value)}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
