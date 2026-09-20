import { SHOW_SCORE_NUMBER } from "@/lib/employee/config";
import { formatCents } from "@/lib/money";
import type { EmployeeRecordSummary } from "@/lib/employee/overview";

function Metric({
  label,
  value,
  copper,
}: {
  label: string;
  value: string;
  copper?: boolean;
}) {
  return (
    <div className="bg-surface px-4 py-4">
      <p className="text-xs text-ink-muted">{label}</p>
      <p
        className={
          copper
            ? "mt-1 text-2xl font-semibold tabular-nums text-copper"
            : "mt-1 text-2xl font-semibold tabular-nums"
        }
      >
        {value}
      </p>
    </div>
  );
}

export function MetricsStrip({ summary }: { summary: EmployeeRecordSummary }) {
  return (
    <section
      aria-label="Record figures"
      className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line md:grid-cols-4"
    >
      <Metric
        label="Current score"
        value={SHOW_SCORE_NUMBER ? String(summary.score) : "Hidden"}
      />
      <Metric label="Paused amount" value={formatCents(summary.pausedCents)} copper />
      <Metric label="Open holds" value={String(summary.holdCount)} />
      <Metric label="Expenses" value={String(summary.expenseCount)} />
    </section>
  );
}
