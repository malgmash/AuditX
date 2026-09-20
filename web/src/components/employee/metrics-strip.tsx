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
    <div className="bg-surface px-4 py-5 sm:px-6">
      <p className="text-xs leading-4 text-ink-muted">{label}</p>
      <p
        className={
          copper
            ? "mt-2 text-2xl font-semibold leading-8 tabular-nums text-copper"
            : "mt-2 text-2xl font-semibold leading-8 tabular-nums"
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
      <Metric label="Total claimed" value={formatCents(summary.totalClaimedCents)} />
      <Metric
        label="Paused"
        value={formatCents(summary.pausedCents)}
        copper={summary.pausedCents > 0}
      />
      <Metric label="Approved" value={String(summary.approvedCount)} />
      <Metric label="Expenses" value={String(summary.expenseCount)} />
    </section>
  );
}
