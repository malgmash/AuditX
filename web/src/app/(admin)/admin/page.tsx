import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getAdminRepo } from "@/lib/admin/repo";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Dashboard" };

function Stat({
  label,
  value,
  detail,
  href,
  copper = false,
}: {
  label: string;
  value: string;
  detail: string;
  href?: string;
  copper?: boolean;
}) {
  const body = (
    <>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className={`mt-1.5 text-3xl font-semibold tabular-nums ${copper ? "text-copper-text" : ""}`}>
        {value}
      </p>
      <p className="mt-1.5 text-xs text-ink-muted">{detail}</p>
    </>
  );
  const shell = "rounded-card border border-line bg-surface p-4";
  return href ? (
    <Link href={href} className={`${shell} block transition-colors hover:border-line-strong`}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}

export default async function AdminDashboard() {
  const repo = getAdminRepo();
  const [stats, cases] = await Promise.all([repo.getStats(), repo.listOpenCases()]);

  return (
    <>
      <h1 className="font-serif text-3xl font-medium">Dashboard</h1>
      <p className="mt-1 text-xs text-ink-muted">
        {stats.openCases === 0
          ? "Nothing is waiting on a decision."
          : `${stats.openCases} ${stats.openCases === 1 ? "case is" : "cases are"} waiting on a decision.`}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Open cases"
          value={String(stats.openCases)}
          detail="Sorted by amount at risk"
          href="/admin/cases"
        />
        <Stat
          label="Amount at risk"
          value={formatCents(stats.amountAtRiskCents)}
          detail="Across every open case"
          copper
        />
        <Stat
          label="Holds active"
          value={String(stats.activeHolds)}
          detail={`${formatCents(stats.heldCents)} paused, unpaid`}
        />
        <Stat
          label="Decided this week"
          value={String(stats.decidedThisWeek)}
          detail="Every decision is recorded"
        />
      </div>

      <section className="mt-3 rounded-card border border-line bg-surface p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold">Waiting on you</h2>
          <Link href="/admin/cases" className="text-xs text-slate underline">
            Open the queue
          </Link>
        </div>

        {cases.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">
            No cases are waiting. New flags will appear here.
          </p>
        ) : (
          <ul className="mt-2">
            {cases.map((c) => (
              <li key={c.id} className="flex items-center gap-3 border-b border-line py-2 last:border-0">
                <Badge variant={c.severity === "IMMEDIATE_HOLD" ? "hold" : "case"}>
                  {c.severity === "IMMEDIATE_HOLD" ? "Immediate hold" : "Case"}
                </Badge>
                <Link
                  href={`/admin/cases#${c.id}`}
                  className="min-w-0 flex-1 truncate text-sm hover:text-slate hover:underline"
                >
                  {c.brief.summary}
                </Link>
                <span className="font-mono text-xs tabular-nums">
                  {formatCents(c.amountAtRiskCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-3 text-xs text-ink-muted">
        The four charts arrive in section 7 and read from the same stats payload as the figures above.
      </p>
    </>
  );
}
