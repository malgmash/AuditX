import type { Prisma } from "@prisma/client";
import type {
  CreateExpenseInput,
  CreateTimesheetInput,
  EmployeeOverview,
  EmployeeRepository,
  ExpenseExtraction,
  ExpenseStatus,
  FindingReviewStatus,
  OwnExpense,
  OwnFinding,
  OwnHold,
  OwnReceipt,
  OwnScore,
  OwnTimesheet,
  ScorePoint,
} from "@/contracts/employee";
import { db } from "@/lib/db";
import { provisionalScore, type PenaltyInput } from "@/lib/employee/provisional-score";
import { ruleCopy } from "@/lib/employee/rule-copy";

/**
 * Reads and writes the signed-in employee's own rows in Postgres. Every query is filtered by the
 * user id at the database layer. Scores and holds come from the Score, ScoreEvent and Hold tables
 * once the analysis service writes them. Until then they are derived from stored findings so the
 * screens show real data, and the derived rows are never written back.
 */

type Json = Prisma.JsonValue;

function record(value: Json | undefined): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function field<T>(value: T, confidence: unknown) {
  return { value, confidence: num(confidence, 0.9) };
}

/**
 * Extraction is stored in two shapes: the camelCase shape the web app writes, and the snake_case
 * shape the data generator and analysis service write. Read either.
 */
export function toExtraction(json: Json | undefined): ExpenseExtraction | null {
  const raw = record(json);
  if (!raw) return null;
  if (raw.merchantName && raw.totalCents) return raw as unknown as ExpenseExtraction;
  if (typeof raw.merchant_name !== "string" || typeof raw.total !== "number") return null;
  const conf = record(raw.field_confidence as Json) ?? {};
  const city = typeof raw.merchant_city === "string" ? raw.merchant_city : null;
  const time = typeof raw.transaction_time === "string" ? raw.transaction_time : null;
  return {
    merchantName: field(raw.merchant_name, conf.merchant_name),
    transactionDate: field(String(raw.transaction_date ?? ""), conf.transaction_date),
    totalCents: field(raw.total, conf.total),
    merchantCity: city ? field(city, conf.merchant_city) : null,
    transactionTime: time ? field<string | null>(time, conf.transaction_time) : null,
    legibility: num(raw.legibility, 1),
    correctedFields: [],
  };
}

type ExpenseRow = Prisma.ExpenseGetPayload<object>;
type ReceiptRow = Prisma.ReceiptGetPayload<object>;

function toReceipt(row: ReceiptRow | undefined): OwnReceipt | null {
  if (!row) return null;
  return { id: row.id, storageKey: row.storageKey, mimeType: row.mimeType, sha256: row.sha256, phash: row.phash };
}

function toExpense(row: ExpenseRow, receipt: ReceiptRow | undefined): OwnExpense {
  const submittedAt = row.submittedAt.toISOString();
  return {
    id: row.id,
    userId: row.userId,
    submittedAt,
    incurredAt: row.incurredAt.toISOString(),
    merchantRaw: row.merchantRaw,
    categoryId: row.categoryId,
    amountCents: row.amountCents,
    currency: "USD",
    description: row.description,
    receipt: toReceipt(receipt),
    status: row.status as ExpenseStatus,
    statusHistory: [{ status: row.status as ExpenseStatus, at: submittedAt }],
    extraction: toExtraction(row.extraction),
  };
}

async function receiptsFor(rows: ExpenseRow[]): Promise<Map<string, ReceiptRow>> {
  const ids = rows.map((r) => r.receiptId).filter((id): id is string => Boolean(id));
  if (ids.length === 0) return new Map();
  const found = await db.receipt.findMany({ where: { id: { in: ids } } });
  return new Map(found.map((r) => [r.id, r]));
}

function reviewStatus(caseStatus: string | undefined): FindingReviewStatus {
  if (caseStatus === "DECLINED") return "NO_ACTION";
  if (caseStatus === "ACCEPTED") return "CONFIRMED";
  return "PENDING_REVIEW";
}

async function loadFindings(userId: string): Promise<OwnFinding[]> {
  const [rows, cases, mine] = await Promise.all([
    db.finding.findMany({ where: { subjectUserId: userId }, orderBy: { detectedAt: "desc" } }),
    db.case.findMany({ where: { subjectUserId: userId } }),
    db.expense.findMany({ where: { userId }, select: { id: true, incurredAt: true } }),
  ]);
  const caseByFinding = new Map<string, string>();
  for (const c of cases) for (const id of c.findingIds) caseByFinding.set(id, c.status);
  const incurred = new Map(mine.map((e) => [e.id, e.incurredAt]));

  return rows.map((f) => {
    const own = f.expenseIds.filter((id) => incurred.has(id));
    const dates = own.map((id) => incurred.get(id)!.getTime());
    const incurredOn = dates.length ? new Date(Math.min(...dates)) : f.detectedAt;
    const copy = ruleCopy(f.ruleId, f.severity);
    return {
      id: f.id,
      userId,
      ruleId: f.ruleId,
      expenseIds: own,
      timesheetIds: f.timesheetIds,
      amountAtRiskCents: f.amountAtRiskCents,
      severity: f.severity,
      detectedAt: f.detectedAt.toISOString(),
      incurredOn: incurredOn.toISOString(),
      reason: copy.reason,
      nextStep: copy.nextStep,
      reviewStatus: reviewStatus(caseByFinding.get(f.id)),
    };
  });
}

async function loadHolds(userId: string, findings: OwnFinding[]): Promise<OwnHold[]> {
  const mine = await db.expense.findMany({ where: { userId }, select: { id: true } });
  const ownIds = new Set(mine.map((e) => e.id));
  const stored = await db.hold.findMany({ where: { expenseId: { in: [...ownIds] } }, orderBy: { placedAt: "desc" } });
  const findingById = new Map(findings.map((f) => [f.id, f]));

  const holds: OwnHold[] = stored.map((h) => {
    const finding = findingById.get(h.findingId);
    const copy = ruleCopy(finding?.ruleId ?? "", finding?.severity ?? "IMMEDIATE_HOLD");
    return {
      id: h.id,
      expenseId: h.expenseId,
      findingId: h.findingId,
      placedAt: h.placedAt.toISOString(),
      releasedAt: h.releasedAt ? h.releasedAt.toISOString() : null,
      reason: copy.reason,
      nextStep: copy.nextStep,
    };
  });

  // Until the analysis service writes Hold rows, an immediate-hold finding on one of the
  // employee's own expenses is shown as a pause. A stored Hold for the finding takes precedence.
  const covered = new Set(stored.map((h) => h.findingId));
  for (const f of findings) {
    if (f.severity !== "IMMEDIATE_HOLD" || covered.has(f.id) || f.reviewStatus === "NO_ACTION") continue;
    const expenseId = f.expenseIds[0];
    if (!expenseId) continue;
    holds.push({
      id: `derived_${f.id}`,
      expenseId,
      findingId: f.id,
      placedAt: f.detectedAt,
      releasedAt: null,
      reason: f.reason,
      nextStep: f.nextStep,
    });
  }
  return holds;
}

async function loadScore(userId: string, findings: OwnFinding[]): Promise<OwnScore> {
  const [scoreRows, eventRows] = await Promise.all([
    db.score.findMany({ where: { scopeType: "user", scopeKey: userId }, orderBy: { asOf: "asc" } }),
    db.scoreEvent.findMany({ where: { scopeType: "user", scopeKey: userId }, orderBy: { createdAt: "desc" } }),
  ]);
  if (scoreRows.length > 0) {
    const last = scoreRows[scoreRows.length - 1]!;
    const history: ScorePoint[] = scoreRows.map((s) => ({ asOf: s.asOf.toISOString(), value: Math.round(s.value) }));
    return {
      userId,
      value: Math.round(last.value),
      asOf: last.asOf.toISOString(),
      history,
      events: eventRows.map((e) => ({
        id: e.id,
        findingId: e.findingId,
        delta: e.delta,
        reason: e.reason,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }

  const penalties = await penaltyInputs(userId, findings);
  const derived = provisionalScore(penalties, new Date());
  return {
    userId,
    value: derived.value,
    asOf: derived.asOf,
    history: derived.history,
    events: derived.events.map((e) => ({
      id: `derived_${e.findingId}`,
      findingId: e.findingId,
      delta: e.delta,
      reason: e.reason,
      createdAt: e.at,
    })),
  };
}

async function penaltyInputs(userId: string, findings: OwnFinding[]): Promise<PenaltyInput[]> {
  const rows = await db.finding.findMany({
    where: { subjectUserId: userId, id: { in: findings.map((f) => f.id) } },
    select: { id: true, penaltyPoints: true },
  });
  const points = new Map(rows.map((r) => [r.id, r.penaltyPoints]));
  return findings
    .filter((f) => f.reviewStatus !== "NO_ACTION")
    .map((f) => ({
      findingId: f.id,
      points: points.get(f.id) ?? 0,
      occurredAt: f.incurredOn,
      reason: `Score changed after this was flagged: ${f.reason}`,
    }));
}

export function createDbEmployeeRepo(): EmployeeRepository {
  return {
    async getOverview(userId: string): Promise<EmployeeOverview | null> {
      const user = await db.user.findUnique({ where: { id: userId }, select: { name: true, department: true } });
      if (!user) return null;
      const findings = await loadFindings(userId);
      const [score, holds] = await Promise.all([loadScore(userId, findings), loadHolds(userId, findings)]);
      return {
        userId,
        name: user.name,
        department: user.department,
        score,
        holds: holds.filter((h) => h.releasedAt === null),
      };
    },

    async getScore(userId: string): Promise<OwnScore | null> {
      const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) return null;
      return loadScore(userId, await loadFindings(userId));
    },

    async listExpenses(userId: string): Promise<OwnExpense[]> {
      const rows = await db.expense.findMany({ where: { userId }, orderBy: { submittedAt: "desc" } });
      const receipts = await receiptsFor(rows);
      return rows.map((r) => toExpense(r, r.receiptId ? receipts.get(r.receiptId) : undefined));
    },

    async getExpense(userId: string, expenseId: string): Promise<OwnExpense | null> {
      const row = await db.expense.findFirst({ where: { id: expenseId, userId } });
      if (!row) return null;
      const receipts = await receiptsFor([row]);
      return toExpense(row, row.receiptId ? receipts.get(row.receiptId) : undefined);
    },

    async listTimesheets(userId: string): Promise<OwnTimesheet[]> {
      const rows = await db.timesheet.findMany({
        where: { userId },
        include: { entries: { orderBy: { workDate: "asc" } } },
        orderBy: { submittedAt: "desc" },
      });
      return rows.map(toTimesheet);
    },

    async getTimesheet(userId: string, timesheetId: string): Promise<OwnTimesheet | null> {
      const row = await db.timesheet.findFirst({
        where: { id: timesheetId, userId },
        include: { entries: { orderBy: { workDate: "asc" } } },
      });
      return row ? toTimesheet(row) : null;
    },

    async listFindings(userId: string): Promise<OwnFinding[]> {
      return loadFindings(userId);
    },

    async getFinding(userId: string, findingId: string): Promise<OwnFinding | null> {
      return (await loadFindings(userId)).find((f) => f.id === findingId) ?? null;
    },

    async listHolds(userId: string): Promise<OwnHold[]> {
      return loadHolds(userId, await loadFindings(userId));
    },

    async createExpense(userId: string, input: CreateExpenseInput): Promise<OwnExpense> {
      const now = new Date();
      const created = await db.$transaction(async (tx) => {
        let receiptId: string | null = null;
        if (input.receipt) {
          const r = await tx.receipt.create({
            data: {
              id: input.receipt.id,
              uploadedById: userId,
              storageKey: input.receipt.storageKey,
              sha256: input.receipt.sha256,
              phash: input.receipt.phash ?? "",
              mimeType: input.receipt.mimeType,
              extractedAt: input.extraction ? now : null,
              embedding: [],
            },
          });
          receiptId = r.id;
        }
        const expense = await tx.expense.create({
          data: {
            userId,
            submittedAt: now,
            incurredAt: new Date(input.incurredAt),
            merchantRaw: input.merchantRaw,
            categoryId: input.categoryId,
            amountCents: input.amountCents,
            currency: "USD",
            description: input.description,
            receiptId,
            status: "SUBMITTED",
            extraction: input.extraction ? (input.extraction as unknown as Prisma.InputJsonValue) : undefined,
          },
        });
        const receipt = receiptId ? await tx.receipt.findUnique({ where: { id: receiptId } }) : null;
        return { expense, receipt };
      });
      return toExpense(created.expense, created.receipt ?? undefined);
    },

    async createTimesheet(userId: string, input: CreateTimesheetInput): Promise<OwnTimesheet> {
      const row = await db.timesheet.create({
        data: {
          userId,
          weekStart: new Date(input.weekStart),
          submittedAt: new Date(),
          status: "SUBMITTED",
          entries: {
            create: input.entries.map((e) => ({
              workDate: new Date(e.workDate),
              startTime: e.startTime ? new Date(e.startTime) : null,
              endTime: e.endTime ? new Date(e.endTime) : null,
              hours: e.hours,
              project: e.project,
              location: e.location,
              note: e.note,
            })),
          },
        },
        include: { entries: { orderBy: { workDate: "asc" } } },
      });
      return toTimesheet(row);
    },
  };
}

type TimesheetRow = Prisma.TimesheetGetPayload<{ include: { entries: true } }>;

function toTimesheet(row: TimesheetRow): OwnTimesheet {
  const submittedAt = row.submittedAt.toISOString();
  return {
    id: row.id,
    userId: row.userId,
    weekStart: row.weekStart.toISOString(),
    submittedAt,
    status: row.status,
    statusHistory: [{ status: row.status, at: submittedAt }],
    entries: row.entries.map((e) => ({
      id: e.id,
      workDate: e.workDate.toISOString(),
      startTime: e.startTime ? e.startTime.toISOString() : null,
      endTime: e.endTime ? e.endTime.toISOString() : null,
      hours: e.hours.toFixed(2),
      project: e.project,
      location: e.location,
      note: e.note,
    })),
  };
}
