import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import type { TimelineEvent } from "@/contracts/admin";
import { getAdminRepo } from "@/lib/admin/repo";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Employee" };

const DAY = 86_400_000;

/**
 * Events laid out on a real date axis, not a list. Three small flags across three months and
 * three in one week read very differently, and only spacing shows that.
 */
function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-ink-muted">Nothing recorded yet.</p>;
  }

  const times = events.map((e) => new Date(e.at).getTime());
  const first = Math.min(...times);
  const last = Math.max(...times);
  const span = Math.max(last - first, DAY);

  return (
    <div>
      <div className="relative h-24 border-b border-line">
        {events.map((e) => {
          const left = ((new Date(e.at).getTime() - first) / span) * 100;
          const isFlag = e.kind === "FINDING" || e.kind === "HOLD";
          return (
            <span
              key={e.id}
              title={`${e.at.slice(0, 10)}: ${e.label}`}
              style={{ left: `${left}%` }}
              className={`absolute bottom-0 block w-0.5 -translate-x-1/2 ${
                isFlag ? "h-20 bg-copper" : "h-10 bg-slate"
              }`}
            />
          );
        })}
      </div>
      <div className="flex justify-between pt-1 text-xs text-ink-muted tabular-nums">
        <span>{new Date(first).toISOString().slice(0, 10)}</span>
        <span>
          {Math.round(span / DAY)} days
        </span>
        <span>{new Date(last).toISOString().slice(0, 10)}</span>
      </div>

      <ul className="mt-4">
        {events.map((e) => (
          <li key={`${e.id}-row`} className="flex gap-3 border-b border-line py-2 last:border-0">
            <span className="w-24 shrink-0 font-mono text-xs text-ink-muted">
              {e.at.slice(0, 10)}
            </span>
            <span className="min-w-0 flex-1 text-sm">{e.label}</span>
            {e.severity ? (
              <Badge variant={e.severity === "IMMEDIATE_HOLD" ? "hold" : e.severity === "CASE" ? "case" : "note"}>
                {e.severity === "IMMEDIATE_HOLD" ? "Immediate hold" : e.severity === "CASE" ? "Case" : "Note"}
              </Badge>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const person = await getAdminRepo().getEmployee(id);
  if (!person) notFound();

  return (
    <>
      <Link href="/admin/employees" className="text-xs text-slate underline">
        Back to employees
      </Link>

      <h1 className="mt-2 font-serif text-3xl font-medium">{person.name}</h1>
      <p className="mt-1 text-xs text-ink-muted">
        {person.jobTitle}, {person.department}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-card border border-line bg-surface p-4">
          <p className="text-xs text-ink-muted">Score</p>
          <p className="mt-1.5 text-3xl font-semibold tabular-nums">{person.score}</p>
          <p className="mt-1.5 text-xs text-ink-muted">Ranks the queue, nothing more</p>
        </div>
        <div className="rounded-card border border-line bg-surface p-4">
          <p className="text-xs text-ink-muted">Amount at risk</p>
          <p className="mt-1.5 text-3xl font-semibold tabular-nums text-copper-text">
            {formatCents(person.amountAtRiskCents)}
          </p>
          <p className="mt-1.5 text-xs text-ink-muted">Across open cases</p>
        </div>
        <div className="rounded-card border border-line bg-surface p-4">
          <p className="text-xs text-ink-muted">Open findings</p>
          <p className="mt-1.5 text-3xl font-semibold tabular-nums">{person.findings.length}</p>
          <p className="mt-1.5 text-xs text-ink-muted">Each expands to its evidence</p>
        </div>
      </div>

      <section className="mt-3 rounded-card border border-line bg-surface p-4">
        <h2 className="text-base font-semibold">Timeline</h2>
        <p className="mb-4 text-xs text-ink-muted">
          Copper marks a flag or a hold. Slate marks an ordinary submission.
        </p>
        <Timeline events={person.timeline} />
      </section>

      <section className="mt-3 rounded-card border border-line bg-surface p-4">
        <h2 className="text-base font-semibold">Findings</h2>
        {person.findings.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">Nothing is flagged for this person.</p>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            {person.findings.map((f) => (
              <details key={f.id} className="border-b border-line pb-2 last:border-0">
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
                  <Badge variant={f.severity === "IMMEDIATE_HOLD" ? "hold" : f.severity === "CASE" ? "case" : "note"}>
                    {f.severity === "IMMEDIATE_HOLD" ? "Immediate hold" : f.severity === "CASE" ? "Case" : "Note"}
                  </Badge>
                  <span className="font-mono text-xs">{f.ruleId}</span>
                  <span className="ml-auto font-mono text-xs tabular-nums text-ink-muted">
                    {formatCents(f.amountAtRiskCents)}
                  </span>
                </summary>
                <dl className="mt-2 grid gap-x-4 sm:grid-cols-2">
                  {f.evidence.map((row) => (
                    <div key={row.label} className="flex justify-between gap-3 border-b border-line py-1.5">
                      <dt className="text-xs text-ink-muted">{row.label}</dt>
                      <dd className="text-right font-mono text-xs">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            ))}
          </div>
        )}
      </section>

      <section className="mt-3 rounded-card border border-line bg-surface p-4">
        <h2 className="text-base font-semibold">Why the score changed</h2>
        <p className="mb-2 text-xs text-ink-muted">
          Append-only. A reversal is a new entry restoring the points, never an edit.
        </p>
        {person.scoreEvents.length === 0 ? (
          <p className="text-sm text-ink-muted">No changes recorded. The score is 100.</p>
        ) : (
          <ul>
            {person.scoreEvents.map((e) => (
              <li key={e.id} className="flex gap-3 border-b border-line py-2 last:border-0">
                <span className="w-24 shrink-0 font-mono text-xs text-ink-muted">
                  {e.createdAt.slice(0, 10)}
                </span>
                <span className="min-w-0 flex-1 text-sm">{e.reason}</span>
                <span
                  className={`font-mono text-xs tabular-nums ${
                    e.delta >= 0 ? "text-sage-text" : "text-copper-text"
                  }`}
                >
                  {e.delta >= 0 ? "+" : ""}
                  {e.delta}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
