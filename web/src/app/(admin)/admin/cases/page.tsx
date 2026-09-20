import Link from "next/link";
import { DecidePanel } from "@/components/admin/DecidePanel";
import { ReverseHoldPanel } from "@/components/admin/ReverseHoldPanel";
import { Badge } from "@/components/ui/badge";
import type { AdminCase } from "@/contracts/admin";
import { getAdminRepo } from "@/lib/admin/repo";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Cases" };

// Fixture decisions live in server memory, so the queue must be read on every request.
export const dynamic = "force-dynamic";

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <>
      <h3 className="mt-6 font-serif text-xl font-medium">{title}</h3>
      <ul className="ml-5 list-disc">
        {items.map((item) => (
          <li key={item} className="mb-1 max-w-[68ch] text-sm">
            {item}
          </li>
        ))}
      </ul>
    </>
  );
}

function severityLabel(severity: AdminCase["severity"]) {
  return severity === "IMMEDIATE_HOLD" ? "Immediate hold" : severity === "CASE" ? "Case" : "Note";
}

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ i?: string }>;
}) {
  const params = await searchParams;
  const cases = await getAdminRepo().listOpenCases();

  if (cases.length === 0) {
    return (
      <>
        <h1 className="font-serif text-3xl font-medium">Cases</h1>
        <p className="mt-1 text-xs text-ink-muted">Nothing is waiting.</p>
        <div className="mt-6 rounded-card border border-line bg-surface p-8 text-center">
          <p className="text-sm text-ink-muted">
            No cases are waiting. New flags will appear here.
          </p>
          <Link href="/admin" className="mt-3 inline-block text-sm text-slate underline">
            Back to the dashboard
          </Link>
        </div>
      </>
    );
  }

  const parsed = Number.parseInt(params.i ?? "0", 10);
  const index = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), cases.length - 1) : 0;
  const item = cases[index];
  const { brief } = item;

  // A held document is named in plain money terms, so the outcome copy can say what is paused.
  const heldDocument = item.documents.find((d) => d.status === "HELD");
  const heldLabel =
    heldDocument && heldDocument.amountCents !== null
      ? formatCents(heldDocument.amountCents)
      : formatCents(item.amountAtRiskCents);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-medium">Cases</h1>
          <p className="mt-1 text-xs text-ink-muted">
            {cases.length} waiting, sorted by amount at risk. Showing {index + 1} of {cases.length}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {index > 0 ? (
            <Link
              href={`/admin/cases?i=${index - 1}`}
              className="flex h-8 items-center rounded-control border border-line-strong bg-surface px-3 text-sm font-semibold hover:bg-slate-tint"
            >
              Previous
            </Link>
          ) : null}
          {index < cases.length - 1 ? (
            <Link
              href={`/admin/cases?i=${index + 1}`}
              className="flex h-8 items-center rounded-control border border-line-strong bg-surface px-3 text-sm font-semibold hover:bg-slate-tint"
            >
              Next
            </Link>
          ) : null}
        </div>
      </div>

      <article className="mt-6 rounded-card border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={item.severity === "IMMEDIATE_HOLD" ? "hold" : "case"}>
            {severityLabel(item.severity)}
          </Badge>
          {item.findings.map((f) => (
            <span key={f.id} className="font-mono text-xs">
              {f.ruleId}
            </span>
          ))}
          <span className="ml-auto font-mono text-xs tabular-nums text-ink-muted">
            {formatCents(item.amountAtRiskCents)} at risk
          </span>
        </div>

        <p className="mt-3 max-w-[68ch] text-base">{brief.summary}</p>

        <p className="mt-2 text-xs text-ink-muted">
          <Link
            href={`/admin/employees/${item.subject.id}`}
            className="text-slate hover:underline"
          >
            {item.subject.name}
          </Link>
          , {item.subject.department}
        </p>

        <h3 className="mt-6 font-serif text-xl font-medium">Why this was flagged</h3>
        <p className="max-w-[68ch] text-sm">{brief.whyFlagged}</p>

        {brief.policyReference ? (
          <div className="mt-3 max-w-[68ch] border-l-2 border-copper pl-3">
            <span className="text-xs font-semibold text-copper-text">Policy</span>
            <p className="text-sm">{brief.policyReference}</p>
          </div>
        ) : null}

        <h3 className="mt-6 font-serif text-xl font-medium">Evidence</h3>
        <dl className="grid gap-x-4 sm:grid-cols-2">
          {item.findings.flatMap((f) =>
            f.evidence.map((row) => (
              <div
                key={`${f.id}-${row.label}`}
                className="flex justify-between gap-3 border-b border-line py-1.5"
              >
                <dt className="text-xs text-ink-muted">{row.label}</dt>
                <dd className="text-right font-mono text-xs">{row.value}</dd>
              </div>
            )),
          )}
        </dl>

        <List title="Worth checking, quickest first" items={brief.reviewSteps} />
        <List title="Questions to ask" items={brief.questionsForEmployee} />
        <List title="This could also be" items={brief.innocentExplanations} />

        <h3 className="mt-6 font-serif text-xl font-medium">Linked documents</h3>
        <ul>
          {item.documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 border-b border-line py-2 last:border-0">
              <Badge variant={doc.status === "HELD" ? "hold" : doc.status === "SUBMITTED" ? "held" : "cleared"}>
                {doc.status === "HELD" ? "Held" : doc.kind === "TIMESHEET" ? "Timesheet" : "Receipt"}
              </Badge>
              <span className="min-w-0 flex-1 truncate text-sm">{doc.label}</span>
              <span className="font-mono text-xs tabular-nums text-ink-muted">
                {doc.occurredOn}
                {doc.amountCents !== null ? ` · ${formatCents(doc.amountCents)}` : ""}
                {doc.hours ? ` · ${doc.hours} h` : ""}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-4 max-w-[68ch] text-xs text-ink-muted">{brief.confidenceNote}</p>

        <ReverseHoldPanel
          subjectName={item.subject.name}
          holds={item.holds
            .filter((h) => h.releasedAt === null)
            .map((h) => ({
              id: h.id,
              amountLabel: formatCents(h.amountCents),
              since: h.placedAt.slice(0, 10),
            }))}
        />

        <DecidePanel
          caseId={item.id}
          subjectName={item.subject.name}
          hasHold={item.holds.some((h) => h.releasedAt === null)}
          heldLabel={heldLabel}
        />
      </article>
    </>
  );
}
