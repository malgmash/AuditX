import type { ExpenseExtraction } from "@/contracts/employee";
import { db } from "@/lib/db";
import { toExtraction } from "@/lib/employee/db-repo";
import { receiptImageUrl } from "@/lib/receipt-storage";

export type FlagOnDocument = { findingId: string; ruleId: string; severity: string; caseId: string | null };

export type ReceiptDetail = {
  kind: "RECEIPT";
  id: string;
  employee: { id: string; name: string; department: string };
  merchant: string;
  category: string;
  description: string;
  amountCents: number;
  incurredAt: string;
  submittedAt: string;
  status: string;
  imageUrl: string | null;
  mimeType: string | null;
  sha256: string | null;
  extraction: ExpenseExtraction | null;
  flags: FlagOnDocument[];
};

export type SheetDay = {
  date: string;
  entries: Array<{ id: string; start: string | null; end: string | null; hours: string; project: string | null; location: string | null; note: string | null }>;
  hours: string;
};

export type TimesheetDetail = {
  kind: "TIMESHEET";
  id: string;
  employee: { id: string; name: string; department: string };
  weekStart: string;
  submittedAt: string;
  status: string;
  days: SheetDay[];
  totalHours: string;
  flags: FlagOnDocument[];
};

async function flagsFor(field: "expenseIds" | "timesheetIds", id: string): Promise<FlagOnDocument[]> {
  const findings = await db.finding.findMany({ where: { [field]: { has: id } }, select: { id: true, ruleId: true, severity: true } });
  if (findings.length === 0) return [];
  const cases = await db.case.findMany({ where: { findingIds: { hasSome: findings.map((f) => f.id) } }, select: { id: true, findingIds: true } });
  return findings.map((f) => ({
    findingId: f.id,
    ruleId: f.ruleId,
    severity: f.severity,
    caseId: cases.find((c) => c.findingIds.includes(f.id))?.id ?? null,
  }));
}

export async function getDocumentDetail(id: string): Promise<ReceiptDetail | TimesheetDetail | null> {
  const expense = await db.expense.findUnique({ where: { id } });
  if (expense) {
    const [user, receipt, flags] = await Promise.all([
      db.user.findUnique({ where: { id: expense.userId }, select: { id: true, name: true, department: true } }),
      expense.receiptId ? db.receipt.findUnique({ where: { id: expense.receiptId } }) : Promise.resolve(null),
      flagsFor("expenseIds", id),
    ]);
    return {
      kind: "RECEIPT",
      id: expense.id,
      employee: user ?? { id: expense.userId, name: "Unknown", department: "" },
      merchant: expense.merchantRaw,
      category: expense.categoryId,
      description: expense.description,
      amountCents: expense.amountCents,
      incurredAt: expense.incurredAt.toISOString(),
      submittedAt: expense.submittedAt.toISOString(),
      status: expense.status,
      imageUrl: receipt ? await receiptImageUrl(receipt.storageKey) : null,
      mimeType: receipt?.mimeType ?? null,
      sha256: receipt?.sha256 ?? null,
      extraction: toExtraction(expense.extraction),
      flags,
    };
  }

  const sheet = await db.timesheet.findUnique({ where: { id }, include: { entries: { orderBy: [{ workDate: "asc" }, { startTime: "asc" }] } } });
  if (!sheet) return null;
  const [user, flags] = await Promise.all([
    db.user.findUnique({ where: { id: sheet.userId }, select: { id: true, name: true, department: true } }),
    flagsFor("timesheetIds", id),
  ]);
  const byDay = new Map<string, SheetDay>();
  const time = (d: Date | null) => (d ? d.toISOString().slice(11, 16) : null);
  for (const e of sheet.entries) {
    const date = e.workDate.toISOString().slice(0, 10);
    const day = byDay.get(date) ?? { date, entries: [], hours: "0.00" };
    day.entries.push({ id: e.id, start: time(e.startTime), end: time(e.endTime), hours: Number(e.hours).toFixed(2), project: e.project, location: e.location, note: e.note });
    day.hours = (Number(day.hours) + Number(e.hours)).toFixed(2);
    byDay.set(date, day);
  }
  const days = [...byDay.values()];
  return {
    kind: "TIMESHEET",
    id: sheet.id,
    employee: user ?? { id: sheet.userId, name: "Unknown", department: "" },
    weekStart: sheet.weekStart.toISOString(),
    submittedAt: sheet.submittedAt.toISOString(),
    status: sheet.status,
    days,
    totalHours: days.reduce((s, d) => s + Number(d.hours), 0).toFixed(2),
    flags,
  };
}
