import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecordFinding } from "@/lib/employee/record";
import { formatCents } from "@/lib/money";

const dayFmt = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function FindingsPanel({ findings }: { findings: RecordFinding[] }) {
  return (
    <section aria-labelledby="findings-heading" className="grid gap-4">
      <h2 id="findings-heading" className="font-serif text-xl font-medium">
        What has been flagged
      </h2>

      {findings.length === 0 ? (
        <p className="max-w-[72ch] text-sm text-ink-muted">
          Nothing has been flagged on your record. New flags will appear here with the reason.
        </p>
      ) : (
        <ul className="grid gap-4">
          {findings.map((finding) => (
            <li key={finding.id}>
              <Card>
                <CardHeader className="px-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle>{finding.severityLabel}</CardTitle>
                    <Badge variant={finding.statusBadge}>{finding.statusLabel}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                    <div>
                      <p className="text-xs text-ink-muted">Amount</p>
                      <p className="text-2xl font-semibold tabular-nums">
                        {formatCents(finding.amountCents)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-muted">Date of the expense</p>
                      <p className="text-sm tabular-nums">
                        {dayFmt.format(new Date(finding.incurredOn))}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-muted">Flagged on</p>
                      <p className="text-sm tabular-nums">
                        {dayFmt.format(new Date(finding.detectedAt))}
                      </p>
                    </div>
                  </div>

                  <p className="max-w-[72ch] text-sm">{finding.reason}</p>
                  <p className="max-w-[72ch] text-xs text-ink-muted">{finding.nextStep}</p>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-control border border-line px-2 py-1 font-mono text-xs">
                      Rule {finding.ruleId}
                    </span>
                    {finding.relatedHrefs.map((related) => (
                      <Link
                        key={related.href}
                        href={related.href}
                        className="text-sm text-slate underline-offset-4 hover:underline"
                      >
                        {related.label}
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
