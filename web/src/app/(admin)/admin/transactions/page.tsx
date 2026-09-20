import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DocumentRow } from "@/contracts/admin";
import { getAdminRepo } from "@/lib/admin/repo";
import { EXPENSE_CATEGORIES } from "@/lib/employee/categories";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Transactions" };

type Params = { employee?: string; month?: string; category?: string; status?: string };

/** The last seven months, newest first, so the list follows whatever data is loaded. */
function recentMonths(): Array<{ value: string; label: string }> {
  const fmt = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    return { value: d.toISOString().slice(0, 7), label: fmt.format(d) };
  });
}

/** Rows drawn at once. The count above the table still says how many matched. */
const SHOWN = 250;

function statusVariant(status: string): "hold" | "held" | "cleared" {
  if (status === "HELD") return "hold";
  if (status === "SUBMITTED") return "held";
  return "cleared";
}

const STATUS_LABEL: Record<string, string> = {
  HELD: "Held",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REIMBURSED: "Reimbursed",
  DECLINED: "Declined",
};

/**
 * Filters are kept in the address, so a filtered view survives a reload and can be shared.
 * Each control is a plain form select that submits with GET.
 */
function Filter({
  name,
  label,
  allLabel,
  options,
  value,
}: {
  name: string;
  label: string;
  allLabel: string;
  options: Array<{ value: string; label: string }>;
  value: string | undefined;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-xs font-semibold text-ink-muted">
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={value ?? ""}
        className="h-8 rounded-control border border-line-strong bg-surface px-2 text-sm"
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function amountFor(row: DocumentRow): string {
  if (row.amountCents !== null) return formatCents(row.amountCents);
  return row.hours ? `${row.hours} h` : "";
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const rows = await getAdminRepo().listDocuments({
    employeeId: params.employee || undefined,
    month: params.month || undefined,
    categoryId: params.category || undefined,
    status: params.status || undefined,
  });

  const employeeOptions = (await getAdminRepo().listEmployees("name", "asc")).map((e) => ({
    value: e.id,
    label: e.name,
  }));
  const categoryOptions = EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }));
  const statusOptions = Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }));
  const months = recentMonths();

  const anyFilter = Boolean(params.employee || params.month || params.category || params.status);

  return (
    <>
      <h1 className="font-serif text-3xl font-medium">Transactions</h1>
      <p className="mt-1 text-xs text-ink-muted">
        Every expense and timesheet. Filters are kept in the address, so a view can be shared.
      </p>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-2">
        <Filter
          name="employee"
          label="Employee"
          allLabel="All employees"
          options={employeeOptions}
          value={params.employee}
        />
        <Filter name="month" label="Date" allLabel="All dates" options={months} value={params.month} />
        <Filter
          name="category"
          label="Category"
          allLabel="All categories"
          options={categoryOptions}
          value={params.category}
        />
        <Filter
          name="status"
          label="Status"
          allLabel="All statuses"
          options={statusOptions}
          value={params.status}
        />
        <button
          type="submit"
          className="h-8 rounded-control border border-line-strong bg-surface px-3 text-sm font-semibold hover:bg-slate-tint"
        >
          Apply
        </button>
        {anyFilter ? (
          <Link
            href="/admin/transactions"
            className="flex h-8 items-center px-1 text-sm text-slate underline"
          >
            Clear
          </Link>
        ) : null}
      </form>

      <div className="mt-3">
        <Table>
          <TableCaption>
            {rows.length} {rows.length === 1 ? "record" : "records"}
            {anyFilter ? " matching these filters." : " across everyone."}
            {rows.length > SHOWN ? ` Showing the newest ${SHOWN}. Add a filter to narrow it.` : ""}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Merchant or week</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Flag</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-ink-muted">
                  No records match these filters. Try widening the date or clearing one of them.
                </TableCell>
              </TableRow>
            ) : (
              rows.slice(0, SHOWN).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="tabular-nums">{row.occurredOn.slice(0, 10)}</TableCell>
                  <TableCell>
                    <Link href={`/admin/transactions/${row.id}`} className="hover:text-slate hover:underline">
                      {row.label}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/employees/${row.employeeId}`}
                      className="hover:text-slate hover:underline"
                    >
                      {row.employeeName}
                    </Link>
                  </TableCell>
                  <TableCell>{row.categoryId}</TableCell>
                  <TableCell className="text-right tabular-nums">{amountFor(row)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(row.status)}>
                      {STATUS_LABEL[row.status] ?? row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.ruleId ?? ""}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
