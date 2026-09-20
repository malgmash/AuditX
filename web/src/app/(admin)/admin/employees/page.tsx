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
import type { EmployeeRow, EmployeeSortKey, SortDirection } from "@/contracts/admin";
import { getAdminRepo } from "@/lib/admin/repo";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Employees" };

const COLUMNS: Array<{ key: EmployeeSortKey; label: string; numeric: boolean }> = [
  { key: "name", label: "Name", numeric: false },
  { key: "department", label: "Department", numeric: false },
  { key: "score", label: "Score", numeric: true },
  { key: "openCases", label: "Open cases", numeric: true },
  { key: "amountAtRisk", label: "Amount at risk", numeric: true },
];

const SORT_KEYS: EmployeeSortKey[] = ["name", "department", "score", "openCases", "amountAtRisk"];

function parseSort(value: string | undefined): EmployeeSortKey {
  return SORT_KEYS.find((k) => k === value) ?? "amountAtRisk";
}

function parseDirection(value: string | undefined): SortDirection {
  return value === "asc" ? "asc" : "desc";
}

/** Sorting lives in the URL, so a sorted view survives a reload and can be shared. */
function SortLink({
  column,
  activeSort,
  activeDirection,
}: {
  column: (typeof COLUMNS)[number];
  activeSort: EmployeeSortKey;
  activeDirection: SortDirection;
}) {
  const isActive = activeSort === column.key;
  const nextDirection: SortDirection = isActive && activeDirection === "desc" ? "asc" : "desc";
  return (
    <Link
      href={`/admin/employees?sort=${column.key}&dir=${nextDirection}`}
      className={`inline-flex items-center gap-1 font-semibold hover:text-slate ${
        isActive ? "text-slate" : ""
      } ${column.numeric ? "w-full justify-end" : ""}`}
    >
      {column.label}
      {isActive ? (
        <span aria-hidden="true">{activeDirection === "desc" ? "↓" : "↑"}</span>
      ) : null}
    </Link>
  );
}

function statusFor(row: EmployeeRow): { variant: "case" | "held" | "cleared"; label: string } {
  if (row.openCases > 0) return { variant: "case", label: "Case open" };
  if (row.amountAtRiskCents > 0) return { variant: "held", label: "Under review" };
  return { variant: "cleared", label: "Cleared" };
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>;
}) {
  const params = await searchParams;
  const sort = parseSort(params.sort);
  const direction = parseDirection(params.dir);
  const rows = await getAdminRepo().listEmployees(sort, direction);

  return (
    <>
      <h1 className="font-serif text-3xl font-medium">Employees</h1>
      <p className="mt-1 text-xs text-ink-muted">
        {rows.length} people. A score ranks this list and never acts on its own.
      </p>

      <div className="mt-6">
        <Table>
          <TableCaption>Select a name to open that person&apos;s full record.</TableCaption>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((column) => (
                <TableHead
                  key={column.key}
                  className={column.numeric ? "text-right" : undefined}
                  aria-sort={
                    sort === column.key
                      ? direction === "desc"
                        ? "descending"
                        : "ascending"
                      : "none"
                  }
                >
                  <SortLink column={column} activeSort={sort} activeDirection={direction} />
                </TableHead>
              ))}
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-ink-muted">
                  No employees yet. They appear here once accounts are created.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const status = statusFor(row);
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={`/admin/employees/${row.id}`}
                        className="hover:text-slate hover:underline"
                      >
                        {row.name}
                      </Link>
                    </TableCell>
                    <TableCell>{row.department}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.score}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.openCases}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCents(row.amountAtRiskCents)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
