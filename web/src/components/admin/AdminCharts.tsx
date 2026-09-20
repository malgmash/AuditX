"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AdminStats } from "@/contracts/admin";
import { CHART_TOOLTIP_STYLE, ChartFrame } from "@/components/employee/chart-frame";

// Series order is fixed by DESIGN.md: slate, copper, sage, ink. Lines are 2px, no gradients, area
// fills at 18% opacity, horizontal gridlines only, 12px axis text.
const SLATE = "var(--color-slate)";
const COPPER = "var(--color-copper)";
const SAGE = "var(--color-sage)";

const AXIS = { fill: "var(--color-ink-muted)", fontSize: 12 } as const;
const MARGIN = { top: 8, right: 8, left: 0, bottom: 0 };

const weekFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const week = (iso: string) => weekFmt.format(new Date(`${iso}T00:00:00Z`));
const dollars = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;
const compact = (cents: number) => {
  const d = cents / 100;
  return d >= 1000 ? `$${Math.round(d / 100) / 10}k` : `$${Math.round(d)}`;
};

function Figure({ title, summary, children }: { title: string; summary: string; children: React.ReactNode }) {
  return (
    <figure className="rounded-card border border-line bg-surface p-4">
      <figcaption className="text-base font-semibold">{title}</figcaption>
      <p className="sr-only">{summary}</p>
      {children}
    </figure>
  );
}

/** Keep the axis readable when there are many weeks: about eight labels. */
const every = (n: number) => Math.max(0, Math.ceil(n / 8) - 1);

export function AnomalyTrend({ data }: { data: AdminStats["findingsByWeek"] }) {
  const rows = data.map((d) => ({ ...d, label: week(d.weekStart) }));
  const total = data.reduce((s, d) => s + d.duplicate + d.expense + d.timesheet, 0);
  return (
    <Figure
      title="How many flags is the system raising each week?"
      summary={`${total} flags over ${data.length} weeks, split into duplicate receipts, expense patterns and timesheet patterns. ${rows
        .map((r) => `${r.label}: ${r.duplicate + r.expense + r.timesheet}`)
        .join(". ")}`}
    >
      <ChartFrame heightClassName="mt-4 h-60">
        {(size) => (
          <LineChart width={size.width} height={size.height} data={rows} margin={MARGIN}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval={every(rows.length)} />
            <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="duplicate" name="Duplicate receipts" stroke={SLATE} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="expense" name="Expense patterns" stroke={COPPER} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="timesheet" name="Timesheet patterns" stroke={SAGE} strokeWidth={2} dot={false} />
          </LineChart>
        )}
      </ChartFrame>
    </Figure>
  );
}

export function FinancialLeakage({ data }: { data: AdminStats["moneyByWeek"] }) {
  const rows = data.map((d) => ({ ...d, label: week(d.weekStart) }));
  const last = data.at(-1);
  return (
    <Figure
      title="How much money has been paused, released and confirmed so far?"
      summary={`Running totals. Paused ${dollars(last?.heldCents ?? 0)}, released ${dollars(last?.releasedCents ?? 0)}, confirmed as needing action ${dollars(last?.confirmedCents ?? 0)}.`}
    >
      <ChartFrame heightClassName="mt-4 h-60">
        {(size) => (
          <AreaChart width={size.width} height={size.height} data={rows} margin={MARGIN}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval={every(rows.length)} />
            <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={compact} width={44} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => dollars(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="confirmedCents" name="Confirmed" stroke={SLATE} strokeWidth={2} fill={SLATE} fillOpacity={0.18} />
            <Area type="monotone" dataKey="heldCents" name="Paused" stroke={COPPER} strokeWidth={2} fill={COPPER} fillOpacity={0.18} />
            <Area type="monotone" dataKey="releasedCents" name="Released" stroke={SAGE} strokeWidth={2} fill={SAGE} fillOpacity={0.18} />
          </AreaChart>
        )}
      </ChartFrame>
    </Figure>
  );
}

export function SeverityMix({ data }: { data: AdminStats["severityByWeek"] }) {
  const rows = data.map((d) => ({ ...d, label: week(d.weekStart) }));
  const t = data.reduce((s, d) => ({ h: s.h + d.immediateHold, c: s.c + d.case, n: s.n + d.note }), { h: 0, c: 0, n: 0 });
  return (
    <Figure
      title="How serious are the flags each week?"
      summary={`Across ${data.length} weeks: ${t.h} immediate holds, ${t.c} cases and ${t.n} notes.`}
    >
      <ChartFrame heightClassName="mt-4 h-60">
        {(size) => (
          <BarChart width={size.width} height={size.height} data={rows} margin={MARGIN}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval={every(rows.length)} />
            <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: "var(--color-slate-tint)" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="case" name="Case" stackId="s" fill={SLATE} />
            <Bar dataKey="immediateHold" name="Immediate hold" stackId="s" fill={COPPER} />
            <Bar dataKey="note" name="Note" stackId="s" fill={SAGE} />
          </BarChart>
        )}
      </ChartFrame>
    </Figure>
  );
}

export function SpendingHistory({ data }: { data: AdminStats["categorySpend"] }) {
  const rows = data.map((d) => ({ ...d, spend: d.spendCents, median: d.departmentMedianCents }));
  return (
    <Figure
      title="Where does the money go, and how does it compare with a typical department?"
      summary={`Spend by category, with the median department spend as a line. ${rows
        .map((r) => `${r.categoryId}: ${dollars(r.spend)}, median ${dollars(r.median)}`)
        .join(". ")}`}
    >
      <ChartFrame heightClassName="mt-4 h-60">
        {(size) => (
          <ComposedChart width={size.width} height={size.height} data={rows} margin={MARGIN}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            <XAxis dataKey="categoryId" tick={AXIS} axisLine={false} tickLine={false} interval={0} angle={-25} textAnchor="end" height={56} />
            <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={compact} width={44} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => dollars(Number(v))} cursor={{ fill: "var(--color-slate-tint)" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="spend" name="Total spend" fill={SLATE} />
            <Line type="monotone" dataKey="median" name="Median department" stroke={COPPER} strokeWidth={2} dot={{ r: 3, fill: COPPER }} />
          </ComposedChart>
        )}
      </ChartFrame>
    </Figure>
  );
}

export function AdminCharts({ stats }: { stats: AdminStats }) {
  return (
    <div className="mt-3 grid gap-3 lg:grid-cols-2">
      <AnomalyTrend data={stats.findingsByWeek} />
      <FinancialLeakage data={stats.moneyByWeek} />
      <SeverityMix data={stats.severityByWeek} />
      <SpendingHistory data={stats.categorySpend} />
    </div>
  );
}

const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

export function ScoreHistory({ data }: { data: Array<{ asOf: string; value: number }> }) {
  const rows = data.map((d) => ({ ...d, label: monthFmt.format(new Date(d.asOf)) }));
  const low = Math.min(100, ...rows.map((r) => r.value));
  return (
    <Figure
      title="How has this score moved, month by month?"
      summary={rows.map((r) => `${r.label}: ${r.value}`).join(". ")}
    >
      <ChartFrame heightClassName="mt-4 h-44">
        {(size) => (
          <LineChart width={size.width} height={size.height} data={rows} margin={MARGIN}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS} axisLine={false} tickLine={false} domain={[Math.max(0, Math.floor(low / 10) * 10 - 10), 100]} width={32} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Line type="monotone" dataKey="value" name="Score" stroke={SLATE} strokeWidth={2} dot={{ r: 3, fill: SLATE }} />
          </LineChart>
        )}
      </ChartFrame>
    </Figure>
  );
}
