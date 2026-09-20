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
    <section aria-labelledby="recent-expenses-heading">
      <h2 id="recent-expenses-heading" className="font-serif text-xl font-medium">
        Recent expenses
      </h2>
      {rows.length === 0 ? (
        <p className="mt-2 max-w-[72ch] text-sm text-ink-muted">
          No expenses yet.{" "}
          <Link href="/employee/expenses/new" className="text-slate underline-offset-4 hover:underline">
            Submit a receipt
          </Link>{" "}
          to add one.
        </p>
      ) : (
        <div className="mt-4">
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
                  <TableCell>{expense.merchantRaw}</TableCell>
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
