import type {
  EmployeeRepository,
  ExpenseStatus,
  OwnExpense,
  OwnReceipt,
  OwnTimesheet,
} from "@/contracts/employee";
import { effectiveExpenseStatus, heldExpenseIds } from "@/lib/employee/expense-status";
import { memoryReceiptStorage } from "@/lib/employee/receipt-file";
import { sampleReceiptExists } from "@/lib/employee/receipt-samples";
import { getEmployeeRepo } from "@/lib/employee/repo";

export type ExpenseDetail = {
  expense: OwnExpense;
  /** Where the receipt image is served from, or null when there is no image to show. */
  receiptUrl: string | null;
  /** HELD when a hold on this expense has not been released, even if the row still says SUBMITTED. */
  status: ExpenseStatus;
};

export type TimesheetDetail = {
  timesheet: OwnTimesheet;
};

/**
 * Null means "not this employee's item", whether it is missing or belongs to someone else.
 * The pages turn that into a 404 so ids cannot be probed.
 */
export async function loadExpenseDetail(
  userId: string,
  expenseId: string,
  repo: EmployeeRepository = getEmployeeRepo(),
): Promise<ExpenseDetail | null> {
  const expense = await repo.getExpense(userId, expenseId);
  if (!expense) return null;
  const [hasImage, holds] = await Promise.all([
    expense.receipt ? receiptImageExists(expense.receipt) : Promise.resolve(false),
    repo.listHolds(userId),
  ]);
  return {
    expense,
    receiptUrl: hasImage && expense.receipt ? `/api/employee/receipts/${expense.receipt.id}` : null,
    status: effectiveExpenseStatus(expense, heldExpenseIds(holds)),
  };
}

/** True when the bytes can actually be served, so the page never shows a broken image. */
export async function receiptImageExists(receipt: OwnReceipt): Promise<boolean> {
  if (await memoryReceiptStorage.get(receipt.storageKey)) return true;
  return sampleReceiptExists(receipt.storageKey);
}

export async function loadTimesheetDetail(
  userId: string,
  timesheetId: string,
  repo: EmployeeRepository = getEmployeeRepo(),
): Promise<TimesheetDetail | null> {
  const timesheet = await repo.getTimesheet(userId, timesheetId);
  return timesheet ? { timesheet } : null;
}

export async function findOwnReceipt(
  userId: string,
  receiptId: string,
  repo: EmployeeRepository = getEmployeeRepo(),
): Promise<OwnExpense["receipt"]> {
  const expenses = await repo.listExpenses(userId);
  return expenses.find((expense) => expense.receipt?.id === receiptId)?.receipt ?? null;
}
