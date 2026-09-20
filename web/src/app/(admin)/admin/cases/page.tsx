import { Badge } from "@/components/ui/badge";
import type { AdminCase } from "@/contracts/admin";
import { getAdminRepo } from "@/lib/admin/repo";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Cases" };

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

function CaseCard({ item }: { item: AdminCase }) {
  const { brief } = item;
  return (
    <article id={item.id} className="rounded-card border border-line bg-surface p-4 scroll-mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={item.severity === "IMMEDIATE_HOLD" ? "hold" : "case"}>
          {item.severity === "IMMEDIATE_HOLD" ? "Immediate hold" : "Case"}
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

      <p className="mt-4 max-w-[68ch] text-xs text-ink-muted">{brief.confidenceNote}</p>

      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <span className="text-xs text-ink-muted">
          Subject: {item.subject.name}, {item.subject.department}. Accept and decline arrive in
          section 3.
        </span>
      </div>
    </article>
  );
}

export default async function CasesPage() {
  const cases = await getAdminRepo().listOpenCases();

  return (
    <>
      <h1 className="font-serif text-3xl font-medium">Cases</h1>
      <p className="mt-1 text-xs text-ink-muted">
        {cases.length === 0
          ? "Nothing is waiting."
          : `${cases.length} waiting, sorted by amount at risk.`}
      </p>

      {cases.length === 0 ? (
        <div className="mt-6 rounded-card border border-line bg-surface p-8 text-center">
          <p className="text-sm text-ink-muted">
            No cases are waiting. New flags will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {cases.map((item) => (
            <CaseCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </>
  );
}
