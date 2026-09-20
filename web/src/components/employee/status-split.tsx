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
    <section aria-labelledby="status-split-heading" className="min-w-0">
      <h2 id="status-split-heading" className="font-serif text-xl font-medium leading-7">
        By status
      </h2>
      {total === 0 ? (
        <div className="mt-4 rounded-card border border-line bg-surface px-6 py-8">
          <p className="max-w-[72ch] text-sm leading-5 text-ink-muted">
            No expenses yet. New submissions will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-4 rounded-card border border-line bg-surface p-6">
          <div className="flex h-2 overflow-hidden rounded-control bg-line" aria-hidden="true">
            {visible.map((row) => (
              <div
                key={row.status}
                className={BAR_CLASS[row.status]}
                style={{ flexGrow: row.count }}
              />
            ))}
          </div>
          <ul className="mt-4 divide-y divide-line">
            {rows.map((row) => (
              <li
                key={row.status}
                className="flex min-h-10 items-center justify-between gap-4 py-2 first:pt-0 last:pb-0"
              >
                <span className="flex items-center gap-2 text-sm leading-5">
                  <span
                    className={`size-2 shrink-0 rounded-control ${BAR_CLASS[row.status]}`}
                    aria-hidden="true"
                  />
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
