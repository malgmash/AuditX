import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SubmissionRow } from "@/lib/employee/submissions";
import { formatCents } from "@/lib/money";

const submittedFmt = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function SubmissionsTable({ rows }: { rows: SubmissionRow[] }) {
  return (
    <Table>
      <TableCaption>Newest submission first. Amounts in US dollars, hours to two decimals.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Submitted</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Item</TableHead>
          <TableHead className="text-right">Amount or hours</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.kind}-${row.id}`}>
            <TableCell className="tabular-nums text-ink-muted">
              {submittedFmt.format(new Date(row.submittedAt))}
            </TableCell>
            <TableCell className="text-ink-muted">
              {row.kind === "expense" ? "Expense" : "Timesheet"}
            </TableCell>
            <TableCell className="whitespace-normal">
              <Link href={row.href} className="font-semibold text-slate underline-offset-4 hover:underline">
                {row.title}
              </Link>
              <span className="block text-xs text-ink-muted">{row.detail}</span>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {row.amountCents !== null ? formatCents(row.amountCents) : `${row.hours} hours`}
            </TableCell>
            <TableCell>
              <Badge variant={row.badge}>{row.statusLabel}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
