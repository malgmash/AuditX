import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { SubmissionFiltersBar } from "@/components/employee/submission-filters";
import { SubmissionsTable } from "@/components/employee/submissions-table";
import { resolveActingUserId } from "@/lib/employee/acting-user";
import { getEmployeeRepo } from "@/lib/employee/repo";
import {
  buildSubmissionRows,
  filterSubmissions,
  parseSubmissionFilters,
  type SubmissionFilters,
} from "@/lib/employee/submissions";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = { title: "My submissions" };

type SearchParams = Record<string, string | string[] | undefined>;

async function SubmissionsBody({ filters }: { filters: SubmissionFilters }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const repo = getEmployeeRepo();
  const actingId = resolveActingUserId(user);
  let expenses;
  let timesheets;
  try {
    [expenses, timesheets] = await Promise.all([
      repo.listExpenses(actingId),
      repo.listTimesheets(actingId),
    ]);
  } catch {
    return (
      <p className="max-w-[72ch] text-sm text-ink-muted">
        We could not load your submissions. Sign in again, or try once more in a moment.
      </p>
    );
  }

  const all = buildSubmissionRows({ expenses, timesheets });
  const rows = filterSubmissions(all, filters);

  if (all.length === 0) {
    return (
      <p className="max-w-[72ch] text-sm text-ink-muted">
        Nothing submitted yet.{" "}
        <Link href="/employee/expenses/new" className="text-slate underline-offset-4 hover:underline">
          Submit an expense
        </Link>{" "}
        or{" "}
        <Link href="/employee/timesheets/new" className="text-slate underline-offset-4 hover:underline">
          fill in a timesheet
        </Link>
        .
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="max-w-[72ch] text-sm text-ink-muted">
        Nothing matches this filter.{" "}
        <Link href="/employee/submissions" className="text-slate underline-offset-4 hover:underline">
          Show everything
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      <p className="text-xs text-ink-muted">
        {rows.length} of {all.length} {all.length === 1 ? "submission" : "submissions"}
      </p>
      <SubmissionsTable rows={rows} />
    </div>
  );
}

function SubmissionsSkeleton() {
  return (
    <div className="grid gap-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filters = parseSubmissionFilters(params);

  return (
    <div className="grid max-w-5xl gap-6">
      <header className="grid gap-1">
        <h1 className="font-serif text-3xl font-medium">My submissions</h1>
        <p className="text-xs text-ink-muted">
          Every expense and timesheet you have sent, newest first, with where each one stands.
        </p>
      </header>

      <SubmissionFiltersBar filters={filters} />

      <Suspense key={`${filters.type}-${filters.status}`} fallback={<SubmissionsSkeleton />}>
        <SubmissionsBody filters={filters} />
      </Suspense>
    </div>
  );
}
