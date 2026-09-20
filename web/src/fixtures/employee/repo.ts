import type {
  CreateExpenseInput,
  CreateTimesheetInput,
  EmployeeOverview,
  EmployeeRepository,
  OwnExpense,
  OwnFinding,
  OwnHold,
  OwnScore,
  OwnTimesheet,
} from "@/contracts/employee";
import {
  expenses as seedExpenses,
  findings as seedFindings,
  FIXTURE_EMPLOYEES,
  holds as seedHolds,
  scores as seedScores,
  timesheets as seedTimesheets,
} from "./data";

function newestFirst<T extends { submittedAt?: string; detectedAt?: string; placedAt?: string }>(
  rows: T[],
  key: "submittedAt" | "detectedAt" | "placedAt",
): T[] {
  return [...rows].sort((a, b) => String(b[key]).localeCompare(String(a[key])));
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function createFixtureEmployeeRepo(): EmployeeRepository {
  const expenses = clone(seedExpenses);
  const timesheets = clone(seedTimesheets);
  const findings = clone(seedFindings);
  const holds = clone(seedHolds);
  const scores = clone(seedScores);
  let nextId = 1;

  return {
    async getOverview(userId: string): Promise<EmployeeOverview | null> {
      const person = FIXTURE_EMPLOYEES[userId as keyof typeof FIXTURE_EMPLOYEES];
      const score = scores.find((s) => s.userId === userId);
      if (!person || !score) return null;
      return {
        userId,
        name: person.name,
        department: person.department,
        score: clone(score),
        holds: clone(holds.filter((h) => h.releasedAt === null && expenses.some((e) => e.id === h.expenseId && e.userId === userId))),
      };
    },

    async getScore(userId: string): Promise<OwnScore | null> {
      const score = scores.find((s) => s.userId === userId);
      return score ? clone(score) : null;
    },

    async listExpenses(userId: string): Promise<OwnExpense[]> {
      return newestFirst(
        expenses.filter((e) => e.userId === userId),
        "submittedAt",
      );
    },

    async getExpense(userId: string, expenseId: string): Promise<OwnExpense | null> {
      const row = expenses.find((e) => e.id === expenseId && e.userId === userId);
      return row ? clone(row) : null;
    },

    async listTimesheets(userId: string): Promise<OwnTimesheet[]> {
      return newestFirst(
        timesheets.filter((t) => t.userId === userId),
        "submittedAt",
      );
    },

    async getTimesheet(userId: string, timesheetId: string): Promise<OwnTimesheet | null> {
      const row = timesheets.find((t) => t.id === timesheetId && t.userId === userId);
      return row ? clone(row) : null;
    },

    async listFindings(userId: string): Promise<OwnFinding[]> {
      return newestFirst(
        findings.filter((f) => f.userId === userId),
        "detectedAt",
      );
    },

    async getFinding(userId: string, findingId: string): Promise<OwnFinding | null> {
      const row = findings.find((f) => f.id === findingId && f.userId === userId);
      return row ? clone(row) : null;
    },

    async listHolds(userId: string): Promise<OwnHold[]> {
      const mine = new Set(expenses.filter((e) => e.userId === userId).map((e) => e.id));
      return newestFirst(
        holds.filter((h) => mine.has(h.expenseId)),
        "placedAt",
      );
    },

    async createExpense(userId: string, input: CreateExpenseInput): Promise<OwnExpense> {
      const now = new Date().toISOString();
      const row: OwnExpense = {
        id: `exp_new_${nextId++}`,
        userId,
        submittedAt: now,
        incurredAt: input.incurredAt,
        merchantRaw: input.merchantRaw,
        categoryId: input.categoryId,
        amountCents: input.amountCents,
        currency: "USD",
        description: input.description,
        receipt: input.receipt,
        status: "SUBMITTED",
        statusHistory: [{ status: "SUBMITTED", at: now }],
        extraction: input.extraction,
      };
      expenses.push(row);
      return clone(row);
    },

    async createTimesheet(userId: string, input: CreateTimesheetInput): Promise<OwnTimesheet> {
      const now = new Date().toISOString();
      const id = `ts_new_${nextId++}`;
      const row: OwnTimesheet = {
        id,
        userId,
        weekStart: input.weekStart,
        submittedAt: now,
        status: "SUBMITTED",
        statusHistory: [{ status: "SUBMITTED", at: now }],
        entries: input.entries.map((entry, i) => ({ ...entry, id: `${id}_e${i}` })),
      };
      timesheets.push(row);
      return clone(row);
    },
  };
}

export const fixtureEmployeeRepo = createFixtureEmployeeRepo();
