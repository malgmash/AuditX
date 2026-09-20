import type { ExpenseStatusCount } from "@/lib/employee/overview";

const BAR_CLASS: Record<ExpenseStatusCount["status"], string> = {
  SUBMITTED: "bg-slate",
  HELD: "bg-copper",
  APPROVED: "bg-sage",
  REIMBURSED: "bg-ink",
  DECLINED: "bg-line-strong",
};

export function StatusSplit({ rows }: { rows: ExpenseStatusCount[] }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const visible = rows.filter((row) => row.count > 0);

  return (
    <section aria-labelledby="status-split-heading">
      <h2 id="status-split-heading" className="font-serif text-xl font-medium">
        How are your expenses split right now?
      </h2>
      {total === 0 ? (
        <p className="mt-2 max-w-[72ch] text-sm text-ink-muted">
          No expenses yet. New submissions will appear here.
        </p>
      ) : (
        <div className="mt-4 grid gap-4">
          <div className="flex h-2 overflow-hidden rounded-control bg-line" aria-hidden="true">
            {visible.map((row) => (
              <div
                key={row.status}
                className={BAR_CLASS[row.status]}
                style={{ flexGrow: row.count }}
              />
            ))}
          </div>
          <ul className="grid gap-2">
            {rows.map((row) => (
              <li key={row.status} className="flex items-baseline justify-between gap-4">
                <span className="flex items-center gap-2 text-sm">
                  <span className={`size-2 shrink-0 rounded-control ${BAR_CLASS[row.status]}`} aria-hidden="true" />
                  {row.label}
                </span>
                <span className="text-sm font-semibold tabular-nums">{row.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
