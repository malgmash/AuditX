import type { ExpenseStatus, OwnExpense, OwnHold } from "@/contracts/employee";

/** Expenses with a hold that has not been released. */
export function heldExpenseIds(holds: OwnHold[]): Set<string> {
  return new Set(holds.filter((hold) => hold.releasedAt === null).map((hold) => hold.expenseId));
}

/**
 * A pause lives in the Hold row, and the analysis service does not move the expense to HELD.
 * The employee must not read "Submitted" on an expense the same screen calls paused.
 */
export function effectiveExpenseStatus(
  expense: Pick<OwnExpense, "id" | "status">,
  heldIds: Set<string>,
): ExpenseStatus {
  return expense.status === "SUBMITTED" && heldIds.has(expense.id) ? "HELD" : expense.status;
}

export function expenseStatusBadgeVariant(
  status: ExpenseStatus,
): "cleared" | "held" | "info" | "note" {
  switch (status) {
    case "APPROVED":
    case "REIMBURSED":
      return "cleared";
    case "HELD":
      return "held";
    case "SUBMITTED":
      return "info";
    case "DECLINED":
      return "note";
  }
}
