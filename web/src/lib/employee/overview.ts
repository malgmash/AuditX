import type { ExpenseStatus, OwnExpense, OwnHold } from "@/contracts/employee";

export const EXPENSE_STATUS_ORDER: ExpenseStatus[] = [
  "SUBMITTED",
  "HELD",
  "APPROVED",
  "REIMBURSED",
  "DECLINED",
];

export type ExpenseStatusCount = {
  status: ExpenseStatus;
  label: string;
  count: number;
};

export type EmployeeRecordSummary = {
  score: number;
  holdCount: number;
  pausedCents: number;
  expenseCount: number;
  approvedCount: number;
  totalClaimedCents: number;
  reimbursedCents: number;
  statusCounts: ExpenseStatusCount[];
};

export function expenseStatusLabel(status: ExpenseStatus): string {
  switch (status) {
    case "SUBMITTED":
      return "Submitted";
    case "HELD":
      return "Held";
    case "APPROVED":
      return "Approved";
    case "REIMBURSED":
      return "Reimbursed";
    case "DECLINED":
      return "Declined";
  }
}

export function summarizeRecord(input: {
  score: number;
  expenses: OwnExpense[];
  holds: OwnHold[];
}): EmployeeRecordSummary {
  const activeHolds = input.holds.filter((hold) => hold.releasedAt === null);
  const pausedCents = activeHolds.reduce((sum, hold) => {
    const expense = input.expenses.find((row) => row.id === hold.expenseId);
    return sum + (expense?.amountCents ?? 0);
  }, 0);

  const tally: Record<ExpenseStatus, number> = {
    SUBMITTED: 0,
    APPROVED: 0,
    HELD: 0,
    DECLINED: 0,
    REIMBURSED: 0,
  };
  for (const expense of input.expenses) {
    tally[expense.status] += 1;
  }

  return {
    score: input.score,
    holdCount: activeHolds.length,
    pausedCents,
    expenseCount: input.expenses.length,
    approvedCount: tally.APPROVED + tally.REIMBURSED,
    totalClaimedCents: input.expenses.reduce((sum, expense) => sum + expense.amountCents, 0),
    reimbursedCents: input.expenses
      .filter((expense) => expense.status === "REIMBURSED")
      .reduce((sum, expense) => sum + expense.amountCents, 0),
    statusCounts: EXPENSE_STATUS_ORDER.map((status) => ({
      status,
      label: expenseStatusLabel(status),
      count: tally[status],
    })),
  };
}
