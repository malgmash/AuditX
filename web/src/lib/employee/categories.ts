/** Fixed category names. Expense.categoryId stores one of these; there is no Category table. */
export const EXPENSE_CATEGORIES = [
  "Meals",
  "Travel",
  "Lodging",
  "Transport",
  "Equipment",
  "Software",
  "Supplies",
  "Client Entertainment",
  "Training",
  "Other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
