import type { Prisma } from "@prisma/client";
import type {
  AdminCase,
  AdminRepository,
  AdminStats,
  AuditEntry,
  CaseStatus,
  CategorySpendPoint,
  DecideCaseInput,
  DecideCaseResult,
  DocumentFilters,
  DocumentRow,
  EmployeeDetail,
  EmployeeRow,
  EmployeeSortKey,
  ExpenseStatus,
  Finding,
  Hold,
  LinkedDocument,
  ReverseHoldInput,
  ReverseHoldResult,
  ScoreEvent,
  ScorePoint,
  Severity,
  SortDirection,
  TimelineEvent,
  TimesheetStatus,
} from "@/contracts/admin";
import { HttpError } from "@/lib/auth/http";
import { buildBrief, evidenceRows } from "@/lib/admin/brief";
import { db } from "@/lib/db";

/**
 * Reads the administrator screens' data from Postgres. Scores, cases and holds are written by the
 * analysis service, so the two mutating calls hand the work to it: one call decides a case or
 * reverses a hold, writes the audit row, notifies the employee and rescores everyone.
 */

const SEVERITY_RANK: Record<Severity, number> = { IMMEDIATE_HOLD: 3, CASE: 2, NOTE: 1 };
const RULE_LABEL: Record<string, string> = {
  DUP_RECEIPT_EXACT: "Same receipt file submitted twice",
  DUP_RECEIPT_IMAGE: "Receipt photo looks like an earlier one",
  DUP_RECEIPT_FIELDS: "Two claims with matching details",
  DUP_RECEIPT_CROSS_USER: "Receipt matches another person's",
  EXP_AMOUNT_OUTLIER_SELF: "Claim above own range",
  EXP_AMOUNT_OUTLIER_PEER: "Claim above department range",
  EXP_VELOCITY: "Several claims in a short period",
  EXP_CATEGORY_MISMATCH: "Category does not match merchant",
  EXP_ROUND_AMOUNT: "Round-amount claim",
  EXP_OFF_PATTERN: "Weekend or holiday claim",
  TS_LOCATION_CONFLICT: "Location conflict",
  TS_OVERLAP: "Overlapping timesheet entries",
  TS_IMPOSSIBLE_HOURS: "More hours than a day holds",
  TS_COPY_PASTE: "Identical weeks",
  TS_ROUND_HOURS: "Eight hours every day",
  TS_HOLIDAY: "Hours on a company holiday",
};

const iso = (d: Date) => d.toISOString();

/** Monday of the week, as YYYY-MM-DD in UTC. */
export function weekStartOf(d: Date): string {
  const day = d.getUTCDay();
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((day + 6) % 7)));
  return monday.toISOString().slice(0, 10);
}

function weeksBetween(first: string, last: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(first); t <= Date.parse(last); t += 7 * 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

type FindingRow = Prisma.FindingGetPayload<object>;
type ExpenseRow = Prisma.ExpenseGetPayload<object>;
type SheetRow = Prisma.TimesheetGetPayload<{ include: { entries: true } }>;

function hoursOf(sheet: SheetRow): string {
  return sheet.entries.reduce((sum, e) => sum + Number(e.hours), 0).toFixed(2);
}

function sheetDoc(sheet: SheetRow): LinkedDocument {
  return {
    id: sheet.id,
    kind: "TIMESHEET",
    label: `Week of ${new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", timeZone: "UTC" }).format(sheet.weekStart)}`,
    occurredOn: iso(sheet.weekStart),
    amountCents: null,
    hours: hoursOf(sheet),
    status: sheet.status as TimesheetStatus,
  };
}

function expenseDoc(e: ExpenseRow): LinkedDocument {
  return {
    id: e.id,
    kind: "RECEIPT",
    label: e.merchantRaw,
    occurredOn: iso(e.incurredAt),
    amountCents: e.amountCents,
    hours: null,
    status: e.status as ExpenseStatus,
  };
}

function toFinding(f: FindingRow): Finding {
  return {
    id: f.id,
    ruleId: f.ruleId,
    subjectUserId: f.subjectUserId,
    expenseIds: f.expenseIds,
    timesheetIds: f.timesheetIds,
    confidence: f.confidence,
    amountAtRiskCents: f.amountAtRiskCents,
    severity: f.severity,
    penaltyPoints: f.penaltyPoints,
    evidence: evidenceRows(f.evidence),
    detectedAt: iso(f.detectedAt),
  };
}

/** When the thing a finding is about happened, so charts and timelines show real spacing. */
function occurredOf(f: FindingRow, expenses: Map<string, ExpenseRow>, sheets: Map<string, { weekStart: Date }>): Date {
  const own = f.expenseIds.map((id) => expenses.get(id)).filter((e): e is ExpenseRow => !!e && e.userId === f.subjectUserId);
  if (own.length) return new Date(Math.max(...own.map((e) => e.incurredAt.getTime())));
  const weeks = f.timesheetIds.map((id) => sheets.get(id)).filter((s): s is { weekStart: Date } => !!s);
  if (weeks.length) return new Date(Math.max(...weeks.map((s) => s.weekStart.getTime())));
  return f.detectedAt;
}

async function latestScores(): Promise<Map<string, number>> {
  const rows = await db.score.findMany({ where: { scopeType: "user" }, orderBy: { asOf: "asc" } });
  const out = new Map<string, number>();
  for (const r of rows) out.set(r.scopeKey, r.value);
  return out;
}

async function loadCases(where: Prisma.CaseWhereInput): Promise<AdminCase[]> {
  const cases = await db.case.findMany({ where, orderBy: { openedAt: "desc" } });
  if (cases.length === 0) return [];
  const findingIds = [...new Set(cases.flatMap((c) => c.findingIds))];
  const findings = await db.finding.findMany({ where: { id: { in: findingIds } } });
  const findingById = new Map(findings.map((f) => [f.id, f]));
  const expenseIds = [...new Set(findings.flatMap((f) => f.expenseIds))];
  const sheetIds = [...new Set(findings.flatMap((f) => f.timesheetIds))];
  const [expenses, sheets, holds, users] = await Promise.all([
    db.expense.findMany({ where: { id: { in: expenseIds } } }),
    db.timesheet.findMany({ where: { id: { in: sheetIds } }, include: { entries: true } }),
    db.hold.findMany({ where: { findingId: { in: findingIds } } }),
    db.user.findMany({ where: { id: { in: [...new Set(cases.map((c) => c.subjectUserId))] } } }),
  ]);
  const expenseById = new Map(expenses.map((e) => [e.id, e]));
  const sheetById = new Map(sheets.map((s) => [s.id, s]));
  const userById = new Map(users.map((u) => [u.id, u]));

  return cases.map((c) => {
    const own = c.findingIds.map((id) => findingById.get(id)).filter((f): f is FindingRow => !!f);
    const subject = userById.get(c.subjectUserId);
    const docs: LinkedDocument[] = [];
    const seen = new Set<string>();
    for (const f of own) {
      for (const id of f.expenseIds) {
        const e = expenseById.get(id);
        if (e && !seen.has(id)) (seen.add(id), docs.push(expenseDoc(e)));
      }
      for (const id of f.timesheetIds) {
        const s = sheetById.get(id);
        if (s && !seen.has(id)) (seen.add(id), docs.push(sheetDoc(s)));
      }
    }
    const first = own[0];
    const claim = first ? first.expenseIds.map((id) => expenseById.get(id)).find((e) => e?.userId === c.subjectUserId) : undefined;
    const amount = own.reduce((sum, f) => sum + f.amountAtRiskCents, 0);
    const caseHolds: Hold[] = holds
      .filter((h) => c.findingIds.includes(h.findingId))
      .map((h) => ({
        id: h.id,
        expenseId: h.expenseId,
        findingId: h.findingId,
        amountCents: expenseById.get(h.expenseId)?.amountCents ?? 0,
        placedAt: iso(h.placedAt),
        releasedAt: h.releasedAt ? iso(h.releasedAt) : null,
        releasedById: h.releasedById,
        reverseNote: h.reverseNote,
      }));
    return {
      id: c.id,
      subject: { id: c.subjectUserId, name: subject?.name ?? "Unknown", department: subject?.department ?? "" },
      status: c.status as CaseStatus,
      severity: own.reduce<Severity>((top, f) => (SEVERITY_RANK[f.severity] > SEVERITY_RANK[top] ? f.severity : top), "NOTE"),
      amountAtRiskCents: amount,
      openedAt: iso(c.openedAt),
      closedAt: c.closedAt ? iso(c.closedAt) : null,
      decisionNote: c.decisionNote,
      findings: own.map(toFinding),
      brief: buildBrief(
        own.map((f) => ({ ruleId: f.ruleId, confidence: f.confidence, evidence: (f.evidence ?? {}) as Record<string, unknown> })),
        {
          subjectName: subject?.name ?? "This person",
          merchant: claim?.merchantRaw ?? null,
          amountCents: claim?.amountCents ?? amount,
          occurredOn: claim ? iso(claim.incurredAt) : first ? iso(first.detectedAt) : null,
        },
      ),
      documents: docs,
      holds: caseHolds,
    };
  });
}

function analysisConfig() {
  return {
    url: (process.env.ANALYSIS_URL ?? "http://localhost:8000").replace(/\/$/, ""),
    token: process.env.INTERNAL_TOKEN ?? "dev-internal-token",
  };
}

/** Call an analysis-service endpoint. An unreachable service is a plain message, not a crash. */
export async function callAnalysis<T>(path: string, body: unknown, timeoutMs = 60000): Promise<T> {
  const { url, token } = analysisConfig();
  let res: Response;
  try {
    res = await fetch(`${url}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Token": token },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new HttpError(503, "The analysis service is not reachable right now. Nothing was changed. Try again in a moment.");
  }
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { detail?: unknown } | null;
    const message = typeof detail?.detail === "string" ? detail.detail : "The analysis service could not do that";
    throw new HttpError(res.status === 409 ? 409 : res.status === 422 ? 422 : 503, message);
  }
  return (await res.json()) as T;
}

export function createDbAdminRepo(): AdminRepository {
  return {
    async listEmployees(sort: EmployeeSortKey = "score", direction: SortDirection = "asc"): Promise<EmployeeRow[]> {
      const [users, scores, open] = await Promise.all([
        db.user.findMany(),
        latestScores(),
        db.case.findMany({ where: { status: { in: ["OPEN", "ESCALATED"] } } }),
      ]);
      const findingIds = [...new Set(open.flatMap((c) => c.findingIds))];
      const findings = findingIds.length ? await db.finding.findMany({ where: { id: { in: findingIds } }, select: { id: true, amountAtRiskCents: true } }) : [];
      const amountOf = new Map(findings.map((f) => [f.id, f.amountAtRiskCents]));
      const rows: EmployeeRow[] = users.map((u) => {
        const mine = open.filter((c) => c.subjectUserId === u.id);
        return {
          id: u.id,
          name: u.name,
          department: u.department,
          score: Math.round((scores.get(u.id) ?? 100) * 100) / 100,
          openCases: mine.length,
          amountAtRiskCents: mine.reduce((sum, c) => sum + c.findingIds.reduce((s, id) => s + (amountOf.get(id) ?? 0), 0), 0),
        };
      });
      const key = (r: EmployeeRow): string | number => (sort === "amountAtRisk" ? r.amountAtRiskCents : r[sort]);
      rows.sort((a, b) => {
        const x = key(a), y = key(b);
        const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
        return (direction === "asc" ? cmp : -cmp) || a.name.localeCompare(b.name);
      });
      return rows;
    },

    async getEmployee(employeeId: string): Promise<EmployeeDetail | null> {
      const user = await db.user.findUnique({ where: { id: employeeId } });
      if (!user) return null;
      const [scoreRows, eventRows, findings, expenses, sheets, cases, holds] = await Promise.all([
        db.score.findMany({ where: { scopeType: "user", scopeKey: employeeId }, orderBy: { asOf: "asc" } }),
        db.scoreEvent.findMany({ where: { scopeType: "user", scopeKey: employeeId }, orderBy: { createdAt: "asc" } }),
        db.finding.findMany({ where: { subjectUserId: employeeId }, orderBy: { detectedAt: "desc" } }),
        db.expense.findMany({ where: { userId: employeeId }, orderBy: { incurredAt: "desc" } }),
        db.timesheet.findMany({ where: { userId: employeeId }, include: { entries: true }, orderBy: { weekStart: "desc" } }),
        db.case.findMany({ where: { subjectUserId: employeeId } }),
        db.hold.findMany({ where: { expenseId: { in: (await db.expense.findMany({ where: { userId: employeeId }, select: { id: true } })).map((e) => e.id) } } }),
      ]);
      const expenseById = new Map(expenses.map((e) => [e.id, e]));
      const sheetById = new Map(sheets.map((s) => [s.id, s]));
      const findingById = new Map(findings.map((f) => [f.id, f]));
      const history: ScorePoint[] = scoreRows.map((s) => ({ asOf: iso(s.asOf), value: Math.round(s.value * 100) / 100 }));
      const events: ScoreEvent[] = eventRows.map((e) => ({ id: e.id, findingId: e.findingId, delta: e.delta, reason: e.reason, createdAt: iso(e.createdAt) }));
      const openAmount = cases
        .filter((c) => c.status === "OPEN" || c.status === "ESCALATED")
        .reduce((sum, c) => sum + c.findingIds.reduce((s, id) => s + (findingById.get(id)?.amountAtRiskCents ?? 0), 0), 0);

      const timeline: TimelineEvent[] = [];
      for (const f of findings) {
        const at = occurredOf(f, expenseById, sheetById);
        timeline.push({ id: `f_${f.id}`, at: iso(at), kind: "FINDING", label: RULE_LABEL[f.ruleId] ?? f.ruleId, severity: f.severity });
      }
      for (const h of holds) {
        const f = findingById.get(h.findingId);
        const at = f ? occurredOf(f, expenseById, sheetById) : h.placedAt;
        timeline.push({ id: `h_${h.id}`, at: iso(at), kind: "HOLD", label: `Hold placed on ${expenseById.get(h.expenseId)?.merchantRaw ?? "a claim"}`, severity: null });
        if (h.releasedAt) timeline.push({ id: `hr_${h.id}`, at: iso(h.releasedAt), kind: "DECISION", label: "Hold released", severity: null });
      }
      for (const c of cases) {
        if (c.closedAt) timeline.push({ id: `d_${c.id}`, at: iso(c.closedAt), kind: "DECISION", label: c.status === "ACCEPTED" ? "Case accepted" : "Case declined", severity: null });
      }
      const linkedExpenses = new Set(findings.flatMap((f) => f.expenseIds));
      for (const id of linkedExpenses) {
        const e = expenseById.get(id);
        if (e) timeline.push({ id: `e_${e.id}`, at: iso(e.incurredAt), kind: "EXPENSE", label: e.merchantRaw, severity: null });
      }
      for (const id of new Set(findings.flatMap((f) => f.timesheetIds))) {
        const s = sheetById.get(id);
        if (s) timeline.push({ id: `t_${s.id}`, at: iso(s.weekStart), kind: "TIMESHEET", label: sheetDoc(s).label, severity: null });
      }
      timeline.sort((a, b) => a.at.localeCompare(b.at));

      return {
        id: user.id,
        name: user.name,
        department: user.department,
        jobTitle: user.jobTitle,
        score: history.length ? history[history.length - 1]!.value : 100,
        scoreHistory: history,
        scoreEvents: events,
        amountAtRiskCents: openAmount,
        findings: findings.map(toFinding),
        documents: [...expenses.map(expenseDoc), ...sheets.map(sheetDoc)].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn)),
        timeline,
      };
    },

    async listOpenCases(): Promise<AdminCase[]> {
      const cases = await loadCases({ status: { in: ["OPEN", "ESCALATED"] } });
      return cases.sort((a, b) => b.amountAtRiskCents - a.amountAtRiskCents || a.id.localeCompare(b.id));
    },

    async getCase(caseId: string): Promise<AdminCase | null> {
      return (await loadCases({ id: caseId }))[0] ?? null;
    },

    async listDocuments(filters: DocumentFilters): Promise<DocumentRow[]> {
      const monthStart = filters.month && /^\d{4}-\d{2}$/.test(filters.month) ? new Date(`${filters.month}-01T00:00:00Z`) : null;
      const monthEnd = monthStart ? new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1)) : null;
      const dateRange = monthStart && monthEnd ? { gte: monthStart, lt: monthEnd } : undefined;
      const status = filters.status;
      const expenseStatuses = ["SUBMITTED", "APPROVED", "HELD", "DECLINED", "REIMBURSED"];
      const sheetStatuses = ["SUBMITTED", "APPROVED", "DECLINED"];
      const [expenses, sheets, users, findings] = await Promise.all([
        filters.categoryId || !status || expenseStatuses.includes(status)
          ? db.expense.findMany({
              where: {
                ...(filters.employeeId ? { userId: filters.employeeId } : {}),
                ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
                ...(status && expenseStatuses.includes(status) ? { status: status as ExpenseStatus } : {}),
                ...(dateRange ? { incurredAt: dateRange } : {}),
              },
              orderBy: { incurredAt: "desc" },
              take: 1500,
            })
          : Promise.resolve([] as ExpenseRow[]),
        filters.categoryId || (status && !sheetStatuses.includes(status))
          ? Promise.resolve([] as SheetRow[])
          : db.timesheet.findMany({
              where: {
                ...(filters.employeeId ? { userId: filters.employeeId } : {}),
                ...(status && sheetStatuses.includes(status) ? { status: status as TimesheetStatus } : {}),
                ...(dateRange ? { weekStart: dateRange } : {}),
              },
              include: { entries: true },
              orderBy: { weekStart: "desc" },
              take: 500,
            }),
        db.user.findMany({ select: { id: true, name: true } }),
        db.finding.findMany({ select: { ruleId: true, expenseIds: true, timesheetIds: true } }),
      ]);
      const name = new Map(users.map((u) => [u.id, u.name]));
      const ruleOf = new Map<string, string>();
      for (const f of findings) for (const id of [...f.expenseIds, ...f.timesheetIds]) if (!ruleOf.has(id)) ruleOf.set(id, f.ruleId);
      const rows: DocumentRow[] = [
        ...expenses.map((e): DocumentRow => ({
          id: e.id, kind: "RECEIPT", occurredOn: iso(e.incurredAt), employeeId: e.userId, employeeName: name.get(e.userId) ?? "Unknown",
          label: e.merchantRaw, categoryId: e.categoryId, amountCents: e.amountCents, hours: null, status: e.status as ExpenseStatus, ruleId: ruleOf.get(e.id) ?? null,
        })),
        ...sheets.map((s): DocumentRow => ({
          id: s.id, kind: "TIMESHEET", occurredOn: iso(s.weekStart), employeeId: s.userId, employeeName: name.get(s.userId) ?? "Unknown",
          label: sheetDoc(s).label, categoryId: "Timesheet", amountCents: null, hours: hoursOf(s), status: s.status as TimesheetStatus, ruleId: ruleOf.get(s.id) ?? null,
        })),
      ];
      return rows.sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
    },

    async getStats(): Promise<AdminStats> {
      const [findings, cases, holds, expenses, sheets, users] = await Promise.all([
        db.finding.findMany(),
        db.case.findMany(),
        db.hold.findMany(),
        db.expense.findMany({ select: { id: true, userId: true, incurredAt: true, categoryId: true, amountCents: true } }),
        db.timesheet.findMany({ select: { id: true, weekStart: true } }),
        db.user.findMany({ select: { id: true, department: true } }),
      ]);
      const expenseById = new Map(expenses.map((e) => [e.id, e as unknown as ExpenseRow]));
      const sheetById = new Map(sheets.map((s) => [s.id, s]));
      const findingById = new Map(findings.map((f) => [f.id, f]));
      const amountOfExpense = new Map(expenses.map((e) => [e.id, e.amountCents]));

      const weekOfFinding = (f: FindingRow) => weekStartOf(occurredOf(f, expenseById, sheetById));
      const openCases = cases.filter((c) => c.status === "OPEN" || c.status === "ESCALATED");
      const liveHolds = holds.filter((h) => !h.releasedAt);
      const weekStartNow = weekStartOf(new Date());

      const allWeeks = findings.map(weekOfFinding).concat(holds.filter((h) => h.releasedAt).map((h) => weekStartOf(h.releasedAt!)));
      const first = allWeeks.length ? allWeeks.reduce((a, b) => (a < b ? a : b)) : weekStartNow;
      const last = allWeeks.length ? allWeeks.reduce((a, b) => (a > b ? a : b)) : weekStartNow;
      const weeks = weeksBetween(first, last > weekStartNow ? last : weekStartNow);

      const family = (ruleId: string) => (ruleId.startsWith("DUP_") ? "duplicate" : ruleId.startsWith("TS_") ? "timesheet" : "expense");
      const findingsByWeek = weeks.map((weekStart) => ({ weekStart, duplicate: 0, expense: 0, timesheet: 0 }));
      const severityByWeek = weeks.map((weekStart) => ({ weekStart, immediateHold: 0, case: 0, note: 0 }));
      const idx = new Map(weeks.map((w, i) => [w, i]));
      for (const f of findings) {
        const i = idx.get(weekOfFinding(f));
        if (i === undefined) continue;
        findingsByWeek[i]![family(f.ruleId)] += 1;
        if (f.severity === "IMMEDIATE_HOLD") severityByWeek[i]!.immediateHold += 1;
        else if (f.severity === "CASE") severityByWeek[i]!.case += 1;
        else severityByWeek[i]!.note += 1;
      }

      const held = new Array<number>(weeks.length).fill(0);
      const released = new Array<number>(weeks.length).fill(0);
      const confirmed = new Array<number>(weeks.length).fill(0);
      for (const h of holds) {
        const f = findingById.get(h.findingId);
        const i = idx.get(f ? weekOfFinding(f) : weekStartOf(h.placedAt));
        if (i !== undefined) held[i]! += amountOfExpense.get(h.expenseId) ?? 0;
        if (h.releasedAt) {
          const j = idx.get(weekStartOf(h.releasedAt));
          if (j !== undefined) released[j]! += amountOfExpense.get(h.expenseId) ?? 0;
        }
      }
      for (const c of cases) {
        if (c.status !== "ACCEPTED" || !c.closedAt) continue;
        const j = idx.get(weekStartOf(c.closedAt));
        if (j !== undefined) confirmed[j]! += c.findingIds.reduce((s, id) => s + (findingById.get(id)?.amountAtRiskCents ?? 0), 0);
      }
      let hSum = 0, rSum = 0, cSum = 0;
      const moneyByWeek = weeks.map((weekStart, i) => ({ weekStart, heldCents: (hSum += held[i]!), releasedCents: (rSum += released[i]!), confirmedCents: (cSum += confirmed[i]!) }));

      const dept = new Map(users.map((u) => [u.id, u.department]));
      const spend = new Map<string, Map<string, number>>();
      for (const e of expenses) {
        const byDept = spend.get(e.categoryId) ?? new Map<string, number>();
        const d = dept.get(e.userId) ?? "Unknown";
        byDept.set(d, (byDept.get(d) ?? 0) + e.amountCents);
        spend.set(e.categoryId, byDept);
      }
      const categorySpend: CategorySpendPoint[] = [...spend.entries()]
        .map(([categoryId, byDept]) => ({
          categoryId,
          spendCents: [...byDept.values()].reduce((a, b) => a + b, 0),
          departmentMedianCents: median([...byDept.values()]),
        }))
        .sort((a, b) => b.spendCents - a.spendCents);

      return {
        openCases: openCases.length,
        amountAtRiskCents: openCases.reduce((sum, c) => sum + c.findingIds.reduce((s, id) => s + (findingById.get(id)?.amountAtRiskCents ?? 0), 0), 0),
        activeHolds: liveHolds.length,
        heldCents: liveHolds.reduce((sum, h) => sum + (amountOfExpense.get(h.expenseId) ?? 0), 0),
        decidedThisWeek: cases.filter((c) => c.closedAt && weekStartOf(c.closedAt) === weekStartNow).length,
        findingsByWeek,
        moneyByWeek,
        severityByWeek,
        categorySpend,
      };
    },

    async listAudit(limit = 20): Promise<AuditEntry[]> {
      const rows = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: limit });
      const users = await db.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.actorId))] } }, select: { id: true, name: true } });
      const name = new Map(users.map((u) => [u.id, u.name]));
      return rows.map((r) => {
        const after = r.after && typeof r.after === "object" && !Array.isArray(r.after) ? (r.after as Record<string, unknown>) : {};
        const note = typeof after.note === "string" && after.note ? `Note: ${after.note}` : "";
        return {
          id: r.id,
          actorId: r.actorId,
          actorName: name.get(r.actorId) ?? "Unknown",
          action: r.action,
          targetType: r.targetType,
          targetId: r.targetId,
          detail: note,
          isSelfReview: r.isSelfReview,
          createdAt: iso(r.createdAt),
        };
      });
    },

    async decideCase(input: DecideCaseInput): Promise<DecideCaseResult> {
      const out = await callAnalysis<{
        case_id: string; status: CaseStatus; score_before: number; score_after: number; is_self_review: boolean;
      }>(`/internal/cases/${encodeURIComponent(input.caseId)}/decide`, {
        decision: input.decision === "ACCEPTED" ? "ACCEPT" : "DECLINE",
        admin_id: input.actor.id,
        note: input.note,
      });
      return {
        caseId: out.case_id,
        status: out.status,
        subjectScoreBefore: Math.round(out.score_before * 100) / 100,
        subjectScoreAfter: Math.round(out.score_after * 100) / 100,
        isSelfReview: out.is_self_review,
      };
    },

    async reverseHold(input: ReverseHoldInput): Promise<ReverseHoldResult> {
      const out = await callAnalysis<{ hold_id: string; score_before: number; score_after: number }>(
        `/internal/holds/${encodeURIComponent(input.holdId)}/reverse`,
        { admin_id: input.actor.id, note: input.note },
      );
      return {
        holdId: out.hold_id,
        releasedAt: new Date().toISOString(),
        subjectScoreBefore: Math.round(out.score_before * 100) / 100,
        subjectScoreAfter: Math.round(out.score_after * 100) / 100,
      };
    },
  };
}
