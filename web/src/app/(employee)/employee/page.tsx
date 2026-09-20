import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { HoldsPanel } from "@/components/employee/holds-panel";
import { MetricsStrip } from "@/components/employee/metrics-strip";
import { OverviewSkeleton } from "@/components/employee/overview-skeleton";
import { RecentExpenses } from "@/components/employee/recent-expenses";
import { ScorePanel } from "@/components/employee/score-panel";
import { StatusSplit } from "@/components/employee/status-split";
import { SHOW_SCORE_NUMBER } from "@/lib/employee/config";
import { summarizeRecord } from "@/lib/employee/overview";
import { resolveActingUserId } from "@/lib/employee/acting-user";
import { getEmployeeRepo } from "@/lib/employee/repo";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = { title: "My record" };

const monthRangeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

async function OverviewBody() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const repo = getEmployeeRepo();
  const actingId = resolveActingUserId(user);
  let overview;
  try {
    overview = await repo.getOverview(actingId);
  } catch {
    return (
      <div className="rounded-card border border-line bg-surface px-6 py-8">
        <p className="max-w-[72ch] text-sm leading-5 text-ink-muted">
          We could not load your record. Sign in again, or try once more in a moment.
        </p>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="rounded-card border border-line bg-surface px-6 py-8">
        <p className="max-w-[72ch] text-sm leading-5 text-ink-muted">
          There is no record for this account yet.{" "}
          <Link
            href="/employee/expenses/new"
            className="font-semibold text-slate underline-offset-4 hover:underline"
          >
            Submit an expense
          </Link>{" "}
          when you have a receipt.
        </p>
      </div>
    );
  }

  const expenses = await repo.listExpenses(actingId);
  const heldItems = overview.holds.map((hold) => ({
    hold,
    amountCents: expenses.find((expense) => expense.id === hold.expenseId)?.amountCents ?? null,
  }));
  const summary = summarizeRecord({
    score: overview.score.value,
    expenses,
    holds: overview.holds,
  });
  const from = overview.score.history[0]?.asOf;
  const to = overview.score.history[overview.score.history.length - 1]?.asOf;
  const range =
    from && to
      ? `${monthRangeFmt.format(new Date(from))} to ${monthRangeFmt.format(new Date(to))}`
      : null;

  return (
    <div className="grid gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div className="min-w-0">
          <h1 className="font-serif text-3xl font-medium leading-9">My record</h1>
          <p className="mt-1 max-w-[72ch] text-xs leading-4 text-ink-muted">
            {range
              ? `Score history ${range}. Held items, claims and recent expenses below.`
              : "Your score, anything paused, and what happens next."}
          </p>
        </div>
        <Button asChild className="min-h-10 active:scale-[0.98]">
          <Link href="/employee/expenses/new">Submit an expense</Link>
        </Button>
      </header>

      <HoldsPanel items={heldItems} />

      <ScorePanel
        value={overview.score.value}
        history={overview.score.history}
        showNumber={SHOW_SCORE_NUMBER}
      />

      <MetricsStrip summary={summary} />

      <div className="grid gap-8 border-t border-line pt-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(16rem,1fr)] lg:items-start lg:gap-10">
        <RecentExpenses expenses={expenses} />
        <StatusSplit rows={summary.statusCounts} />
      </div>
    </div>
  );
}

export default function EmployeeHome() {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <OverviewBody />
    </Suspense>
  );
}
