import type { ExpenseStatus } from "@/contracts/employee";

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
