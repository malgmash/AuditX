import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { OwnExpense } from "@/contracts/employee";
import { expenseStatusBadgeVariant } from "@/lib/employee/expense-status";
import { expenseStatusLabel } from "@/lib/employee/overview";
import { formatCents } from "@/lib/money";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function RecentExpenses({ expenses }: { expenses: OwnExpense[] }) {
  const rows = expenses.slice(0, 8);

  return (
    <section aria-labelledby="recent-expenses-heading" className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="recent-expenses-heading" className="font-serif text-xl font-medium leading-7">
          Recent expenses
        </h2>
        <Link
          href="/employee/expenses/new"
          className="inline-flex min-h-10 items-center text-sm text-slate underline-offset-4 transition-colors duration-150 hover:underline active:scale-[0.98]"
        >
          Submit a receipt
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="mt-4 rounded-card border border-line bg-surface px-6 py-8">
          <p className="max-w-[72ch] text-sm leading-5 text-ink-muted">
            No expenses yet.{" "}
            <Link
              href="/employee/expenses/new"
              className="font-semibold text-slate underline-offset-4 hover:underline"
            >
              Submit a receipt
            </Link>{" "}
            to add one.
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-card border border-line bg-surface">
          <Table>
            <TableCaption>Newest submissions first. Amounts in US dollars.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Merchant</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="tabular-nums text-ink-muted">
                    {dateFmt.format(new Date(expense.incurredAt))}
                  </TableCell>
                  <TableCell className="font-medium">{expense.merchantRaw}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCents(expense.amountCents)}</TableCell>
                  <TableCell>
                    <Badge variant={expenseStatusBadgeVariant(expense.status)}>
                      {expenseStatusLabel(expense.status)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
