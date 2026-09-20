// The fixture implementation of AdminRepository. Selected when AUDITX_DATA is not "db".
//
// The score is never stored. It is derived by summing the append-only score events, which is
// what makes reversal exact: releasing a hold appends the points back and the number returns to
// the value it held before, to two decimal places.

import type {
  AdminCase,
  AdminRepository,
  AdminStats,
  AuditEntry,
  DecideCaseInput,
  DecideCaseResult,
  DocumentFilters,
  DocumentRow,
  EmployeeDetail,
  EmployeeRow,
  EmployeeSortKey,
  ReverseHoldInput,
  ReverseHoldResult,
  ScoreEvent,
  ScorePoint,
  SortDirection,
} from "@/contracts/admin";
import {
  AUDIT,
  CASES,
  CATEGORY_SPEND,
  DECIDED_THIS_WEEK,
  DOCUMENTS,
  EMPLOYEES,
  FINDINGS_BY_WEEK,
  MONEY_BY_WEEK,
  SEVERITY_BY_WEEK,
  WEEK_STARTS,
  type FixtureEmployee,
} from "@/fixtures/admin/data";

/** In-memory session state. Mutating calls append here; nothing is ever edited in place. */
const extraEvents: ScoreEvent[] = [];
const extraAudit: AuditEntry[] = [];
const decisions = new Map<string, { status: "ACCEPTED" | "DECLINED"; note: string | null; at: string }>();
const releasedHolds = new Map<string, { at: string; byId: string; note: string | null }>();

let seq = 0;
const nextId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(seq += 1)}`;

const round2 = (n: number) => Math.round(n * 100) / 100;

function eventsFor(employeeId: string): ScoreEvent[] {
  const base = EMPLOYEES.find((e) => e.id === employeeId)?.scoreEvents ?? [];
  const extra = extraEvents.filter((e) => e.id.startsWith(`se_${employeeId}`));
  return [...base, ...extra].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** clamp(100 + sum of deltas, 0, 100). Penalties are negative, restorations positive. */
function scoreFor(employeeId: string): number {
  const total = eventsFor(employeeId).reduce((sum, e) => sum + e.delta, 0);
  return round2(Math.min(100, Math.max(0, 100 + total)));
}

function historyFor(employeeId: string): ScorePoint[] {
  let running = 100;
  const points: ScorePoint[] = [{ asOf: "2026-06-29T00:00:00Z", value: 100 }];
  for (const e of eventsFor(employeeId)) {
    running = Math.min(100, Math.max(0, running + e.delta));
    points.push({ asOf: e.createdAt, value: round2(running) });
  }
  return points;
}

function openCasesFor(employeeId: string): AdminCase[] {
  return openCases().filter((c) => c.subject.id === employeeId);
}

/** A case is open until a decision is recorded against it this session. */
function openCases(): AdminCase[] {
  return CASES.filter((c) => !decisions.has(c.id)).map(withHoldState);
}

function withHoldState(c: AdminCase): AdminCase {
  const holds = c.holds.map((h) => {
    const released = releasedHolds.get(h.id);
    return released
      ? { ...h, releasedAt: released.at, releasedById: released.byId, reverseNote: released.note }
      : h;
  });
  const decision = decisions.get(c.id);
  return {
    ...c,
    holds,
    status: decision ? decision.status : c.status,
    closedAt: decision ? decision.at : c.closedAt,
    decisionNote: decision ? decision.note : c.decisionNote,
  };
}

function amountAtRiskFor(employeeId: string): number {
  return openCasesFor(employeeId).reduce((sum, c) => sum + c.amountAtRiskCents, 0);
}

function toRow(e: FixtureEmployee): EmployeeRow {
  return {
    id: e.id,
    name: e.name,
    department: e.department,
    score: scoreFor(e.id),
    openCases: openCasesFor(e.id).length,
    amountAtRiskCents: amountAtRiskFor(e.id),
  };
}

function compare(a: EmployeeRow, b: EmployeeRow, key: EmployeeSortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name);
    case "department":
      return a.department.localeCompare(b.department) || a.name.localeCompare(b.name);
    case "score":
      return a.score - b.score;
    case "openCases":
      return a.openCases - b.openCases;
    case "amountAtRisk":
      return a.amountAtRiskCents - b.amountAtRiskCents;
  }
}

function auditEntries(): AuditEntry[] {
  return [...extraAudit, ...AUDIT].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function writeAudit(entry: Omit<AuditEntry, "id" | "createdAt">): void {
  extraAudit.unshift({ ...entry, id: nextId("aud"), createdAt: new Date().toISOString() });
}

export const fixtureAdminRepo: AdminRepository = {
  async listEmployees(sort: EmployeeSortKey = "amountAtRisk", direction: SortDirection = "desc") {
    const rows = EMPLOYEES.map(toRow);
    rows.sort((a, b) => (direction === "asc" ? compare(a, b, sort) : compare(b, a, sort)));
    return rows;
  },

  async getEmployee(employeeId: string): Promise<EmployeeDetail | null> {
    const e = EMPLOYEES.find((x) => x.id === employeeId);
    if (!e) return null;
    const cases = openCasesFor(employeeId);
    return {
      id: e.id,
      name: e.name,
      department: e.department,
      jobTitle: e.jobTitle,
      score: scoreFor(e.id),
      scoreHistory: historyFor(e.id),
      scoreEvents: eventsFor(e.id),
      amountAtRiskCents: amountAtRiskFor(e.id),
      findings: cases.flatMap((c) => c.findings),
      documents: cases.flatMap((c) => c.documents),
      timeline: [...e.timeline].sort((a, b) => a.at.localeCompare(b.at)),
    };
  },

  async listOpenCases() {
    return openCases().sort((a, b) => b.amountAtRiskCents - a.amountAtRiskCents);
  },

  async getCase(caseId: string) {
    const found = CASES.find((c) => c.id === caseId);
    return found ? withHoldState(found) : null;
  },

  async listDocuments(filters: DocumentFilters) {
    return DOCUMENTS.filter((d) => {
      if (filters.employeeId && d.employeeId !== filters.employeeId) return false;
      if (filters.month && !d.occurredOn.startsWith(filters.month)) return false;
      if (filters.categoryId && d.categoryId !== filters.categoryId) return false;
      if (filters.status && d.status !== filters.status) return false;
      return true;
    }).sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
  },

  async getStats(): Promise<AdminStats> {
    const open = openCases();
    const liveHolds = open.flatMap((c) => c.holds).filter((h) => h.releasedAt === null);
    return {
      openCases: open.length,
      amountAtRiskCents: open.reduce((sum, c) => sum + c.amountAtRiskCents, 0),
      activeHolds: liveHolds.length,
      heldCents: liveHolds.reduce((sum, h) => sum + h.amountCents, 0),
      decidedThisWeek: DECIDED_THIS_WEEK + decisions.size,
      findingsByWeek: WEEK_STARTS.map((weekStart, i) => ({ weekStart, ...FINDINGS_BY_WEEK[i] })),
      moneyByWeek: WEEK_STARTS.map((weekStart, i) => ({ weekStart, ...MONEY_BY_WEEK[i] })),
      severityByWeek: WEEK_STARTS.map((weekStart, i) => ({ weekStart, ...SEVERITY_BY_WEEK[i] })),
      categorySpend: CATEGORY_SPEND,
    };
  },

  async listAudit(limit = 20) {
    return auditEntries().slice(0, limit);
  },

  async decideCase(input: DecideCaseInput): Promise<DecideCaseResult> {
    const found = CASES.find((c) => c.id === input.caseId);
    if (!found) throw new Error(`Unknown case ${input.caseId}`);
    if (decisions.has(input.caseId)) throw new Error("This case has already been decided");

    const subjectId = found.subject.id;
    const before = scoreFor(subjectId);

    // Declining releases the points the open case was holding. Accepting confirms them, and the
    // finding keeps its penalty. Either way the finding itself is never deleted.
    if (input.decision === "DECLINED") {
      const restore = found.findings.reduce((sum, f) => sum + f.penaltyPoints, 0);
      extraEvents.push({
        id: `se_${subjectId}_${nextId("rev")}`,
        findingId: found.findings[0]?.id ?? null,
        delta: round2(restore),
        reason: "Case declined, points restored",
        createdAt: new Date().toISOString(),
      });
    }

    decisions.set(input.caseId, {
      status: input.decision,
      note: input.note,
      at: new Date().toISOString(),
    });

    const isSelfReview = subjectId === input.actor.id;
    writeAudit({
      actorId: input.actor.id,
      actorName: input.actor.name,
      action: "CASE_DECIDED",
      targetType: "Case",
      targetId: input.caseId,
      detail:
        `${input.decision === "ACCEPTED" ? "Accepted" : "Declined"}. ` +
        `Score ${before} to ${scoreFor(subjectId)}.` +
        (input.note ? ` Note: ${input.note}` : ""),
      isSelfReview,
    });

    return {
      caseId: input.caseId,
      status: input.decision,
      subjectScoreBefore: before,
      subjectScoreAfter: scoreFor(subjectId),
      isSelfReview,
    };
  },

  async reverseHold(input: ReverseHoldInput): Promise<ReverseHoldResult> {
    const owner = CASES.find((c) => c.holds.some((h) => h.id === input.holdId));
    const hold = owner?.holds.find((h) => h.id === input.holdId);
    if (!owner || !hold) throw new Error(`Unknown hold ${input.holdId}`);
    if (releasedHolds.has(input.holdId)) throw new Error("This hold has already been released");

    const subjectId = owner.subject.id;
    const before = scoreFor(subjectId);
    const finding = owner.findings.find((f) => f.id === hold.findingId);
    const at = new Date().toISOString();

    extraEvents.push({
      id: `se_${subjectId}_${nextId("rel")}`,
      findingId: hold.findingId,
      delta: round2(finding?.penaltyPoints ?? 0),
      reason: "Hold released, points restored",
      createdAt: at,
    });
    releasedHolds.set(input.holdId, { at, byId: input.actor.id, note: input.note });

    writeAudit({
      actorId: input.actor.id,
      actorName: input.actor.name,
      action: "HOLD_REVERSED",
      targetType: "Hold",
      targetId: input.holdId,
      detail:
        `Released. Score ${before} to ${scoreFor(subjectId)}.` +
        (input.note ? ` Note: ${input.note}` : ""),
      isSelfReview: subjectId === input.actor.id,
    });

    return {
      holdId: input.holdId,
      releasedAt: at,
      subjectScoreBefore: before,
      subjectScoreAfter: scoreFor(subjectId),
    };
  },
};
