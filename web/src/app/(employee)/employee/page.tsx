import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { DonutChart } from "@/components/employee/donut-chart";
import { HoldsPanel } from "@/components/employee/holds-panel";
import { OverviewKpis } from "@/components/employee/overview-kpis";
import { OverviewSkeleton } from "@/components/employee/overview-skeleton";
import { RecentExpenses } from "@/components/employee/recent-expenses";
import { ScoreBars } from "@/components/employee/score-bars";
import { ScorePanel } from "@/components/employee/score-panel";
import { summarizeRecord } from "@/lib/employee/overview";
import { resolveActingUserId } from "@/lib/employee/acting-user";
import { getEmployeeRepo } from "@/lib/employee/repo";
import { getSessionUser } from "@/lib/auth/session";
import { formatCents } from "@/lib/money";
import { Suspense } from "react";
import { redirect } from "next/navigation";

export const metadata = { title: "My record" };


const monthRangeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const STATUS_FILL = {
  SUBMITTED: "var(--color-slate)",
  HELD: "var(--color-copper)",
  APPROVED: "var(--color-sage)",
  REIMBURSED: "var(--color-ink)",
  DECLINED: "var(--color-line-strong)",
} as const;

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
      <p className="max-w-[72ch] text-sm text-ink-muted">
        We could not load your record. Sign in again, or try once more in a moment.
      </p>
    );
  }

  if (!overview) {
    return (
      <p className="max-w-[72ch] text-sm text-ink-muted">
        There is no record for this account yet. Submit an expense when you have a receipt.
      </p>
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
    from && to ? `${monthRangeFmt.format(new Date(from))} to ${monthRangeFmt.format(new Date(to))}` : null;

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-medium">My record</h1>
          <p className="mt-1 text-xs text-ink-muted">
            {range ?? "Your score, anything paused, and what happens next."}
          </p>
        </div>
        <Link
          href="/employee/expenses/new"
          className="inline-flex min-h-10 items-center justify-center rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Submit an expense
        </Link>
      </header>

      <OverviewKpis summary={summary} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="grid gap-6 px-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-ink-muted">Total claimed</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCents(summary.totalClaimedCents)}</p>
              </div>
              <div>
                <p className="text-xs text-ink-muted">Paused</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-copper">
                  {formatCents(summary.pausedCents)}
                </p>
              </div>
            </div>
            <ScoreBars history={overview.score.history} />
          </CardContent>
        </Card>
        <div className="grid gap-4">
          <Card>
            <CardContent className="px-6 py-4">
              <DonutChart
                title="How many expenses sit in each status?"
                centerLabel="Total"
                centerValue={String(summary.expenseCount)}
                slices={summary.statusCounts.map((row) => ({
                  label: row.label,
                  value: row.count,
                  fill: STATUS_FILL[row.status],
                }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-6 py-4">
              <DonutChart
                title="Where is the money right now?"
                centerLabel="Claimed"
                centerValue={formatCents(summary.totalClaimedCents)}
                unit="usd"
                slices={[
                  { label: "Paused", value: summary.pausedCents, fill: "var(--color-copper)" },
                  { label: "Reimbursed", value: summary.reimbursedCents, fill: "var(--color-sage)" },
                  {
                    label: "In review",
                    value: Math.max(0, summary.totalClaimedCents - summary.pausedCents - summary.reimbursedCents),
                    fill: "var(--color-slate)",
                  },
                ]}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ScorePanel history={overview.score.history} />
        <Card>
          <CardContent className="px-6 py-4">
            <RecentExpenses expenses={expenses} />
          </CardContent>
        </Card>
      </div>

      <HoldsPanel items={heldItems} />
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
