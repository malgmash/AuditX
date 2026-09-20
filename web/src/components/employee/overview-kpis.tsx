"use client";

import { Activity, CircleCheck, Pause, Receipt } from "lucide-react";
import { KpiCard } from "@/components/employee/kpi-card";
import type { EmployeeRecordSummary } from "@/lib/employee/overview";
import { SHOW_SCORE_NUMBER } from "@/lib/employee/config";

export function OverviewKpis({ summary }: { summary: EmployeeRecordSummary }) {
  return (
    <section aria-label="Record figures" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <KpiCard
        label="Expenses"
        value={String(summary.expenseCount)}
        icon={<Receipt className="size-4" strokeWidth={1.5} aria-hidden="true" />}
      />
      <KpiCard
        label="Approved"
        value={String(summary.approvedCount)}
        icon={<CircleCheck className="size-4" strokeWidth={1.5} aria-hidden="true" />}
      />
      <KpiCard
        label="Current score"
        value={SHOW_SCORE_NUMBER ? String(summary.score) : "Hidden"}
        icon={<Activity className="size-4" strokeWidth={1.5} aria-hidden="true" />}
      />
      <KpiCard
        label="Open holds"
        value={String(summary.holdCount)}
        icon={<Pause className="size-4" strokeWidth={1.5} aria-hidden="true" />}
        copper={summary.holdCount > 0}
      />
    </section>
  );
}
