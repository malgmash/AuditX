import type {
  FindingReviewStatus,
  FindingSeverity,
  OwnFinding,
  OwnScoreEvent,
} from "@/contracts/employee";
import { SHOW_DECLINED_FINDINGS } from "@/lib/employee/config";

export type RecordBadge = "cleared" | "held" | "hold" | "case" | "note" | "info";

export type RecordFinding = {
  id: string;
  ruleId: string;
  reason: string;
  nextStep: string;
  amountCents: number;
  incurredOn: string;
  detectedAt: string;
  statusLabel: string;
  statusBadge: RecordBadge;
  severityLabel: string;
  /** Links to the employee's own submissions this finding is about. */
  relatedHrefs: Array<{ label: string; href: string }>;
};

export type RecordScoreChange = {
  id: string;
  findingId: string | null;
  deltaLabel: string;
  reason: string;
  createdAt: string;
};

/** DESIGN.md: a declined finding reads as a record of review, never as a flag. */
export function reviewStatusLabel(status: FindingReviewStatus): string {
  switch (status) {
    case "PENDING_REVIEW":
      return "Pending review";
    case "NO_ACTION":
      return "Reviewed, no action taken";
    case "CONFIRMED":
      return "Confirmed";
  }
}

export function reviewStatusBadge(status: FindingReviewStatus): RecordBadge {
  switch (status) {
    case "PENDING_REVIEW":
      return "held";
    case "NO_ACTION":
      return "note";
    case "CONFIRMED":
      return "case";
  }
}

export function severityLabel(severity: FindingSeverity): string {
  switch (severity) {
    case "IMMEDIATE_HOLD":
      return "Reimbursement paused";
    case "CASE":
      return "With a reviewer";
    case "NOTE":
      return "Recorded as a note";
  }
}

/** "+12", "+1", or "No change", so a zero delta never reads as a penalty. */
export function deltaLabel(delta: number): string {
  if (delta === 0) return "No change";
  return delta > 0 ? `+${delta}` : String(delta);
}

export function toRecordFinding(finding: OwnFinding): RecordFinding {
  return {
    id: finding.id,
    ruleId: finding.ruleId,
    reason: finding.reason,
    nextStep: finding.nextStep,
    amountCents: finding.amountAtRiskCents,
    incurredOn: finding.incurredOn,
    detectedAt: finding.detectedAt,
    statusLabel: reviewStatusLabel(finding.reviewStatus),
    statusBadge: reviewStatusBadge(finding.reviewStatus),
    severityLabel: severityLabel(finding.severity),
    relatedHrefs: [
      ...finding.expenseIds.map((id) => ({
        label: "The expense",
        href: `/employee/submissions/expense/${id}`,
      })),
      ...finding.timesheetIds.map((id) => ({
        label: "The timesheet",
        href: `/employee/submissions/timesheet/${id}`,
      })),
    ],
  };
}

/** Newest first. Declined findings appear only when the flag allows it. */
export function buildRecordFindings(
  findings: OwnFinding[],
  showDeclined: boolean = SHOW_DECLINED_FINDINGS,
): RecordFinding[] {
  return findings
    .filter((finding) => showDeclined || finding.reviewStatus !== "NO_ACTION")
    .map(toRecordFinding)
    .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
}

export function buildScoreChanges(events: OwnScoreEvent[]): RecordScoreChange[] {
  return [...events]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((event) => ({
      id: event.id,
      findingId: event.findingId,
      deltaLabel: deltaLabel(event.delta),
      reason: event.reason,
      createdAt: event.createdAt,
    }));
}
