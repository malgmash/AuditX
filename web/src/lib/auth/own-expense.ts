import { db } from "@/lib/db";
import { HttpError } from "@/lib/auth/http";

/**
 * The only safe Prisma where-clause for an expense loaded from a URL id.
 * Never look up Expense by id alone: an employee can edit the id in the address bar.
 */
export function ownExpenseWhere(userId: string, expenseId: string) {
  return { id: expenseId, userId };
}

/**
 * Load one expense for the signed-in user. Missing and other people's rows are the same 404
 * so the URL cannot be used to probe whether an id exists.
 */
export async function loadOwnExpense(userId: string, expenseId: string) {
  const expense = await db.expense.findFirst({
    where: ownExpenseWhere(userId, expenseId),
    select: {
      id: true,
      userId: true,
      amountCents: true,
      merchantRaw: true,
      status: true,
      incurredAt: true,
    },
  });
  if (!expense) throw new HttpError(404, "Not found");
  return expense;
}
