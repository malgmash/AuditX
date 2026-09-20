import type {
  ExpenseStatus,
  OwnExpense,
  OwnHold,
  OwnTimesheet,
  OwnTimesheetEntry,
  TimesheetStatus,
} from "@/contracts/employee";
import {
  effectiveExpenseStatus,
  expenseStatusBadgeVariant,
  heldExpenseIds,
} from "@/lib/employee/expense-status";
import { expenseStatusLabel } from "@/lib/employee/overview";
import { formatHoursHundredths, parseHoursHundredths } from "@/lib/employee/timesheet-hours";

export type SubmissionKind = "expense" | "timesheet";
export type SubmissionBadge = "cleared" | "held" | "info" | "note";

export type SubmissionRow = {
  kind: SubmissionKind;
  id: string;
  href: string;
  submittedAt: string;
  title: string;
  /** Second line under the title: category and date incurred, or the hours worked. */
  detail: string;
  amountCents: number | null;
  hours: string | null;
  status: ExpenseStatus | TimesheetStatus;
  statusLabel: string;
  badge: SubmissionBadge;
};

export type SubmissionTypeFilter = "all" | SubmissionKind;
export type SubmissionStatusFilter = "all" | ExpenseStatus | TimesheetStatus;

export type SubmissionFilters = {
  type: SubmissionTypeFilter;
  status: SubmissionStatusFilter;
};

export const SUBMISSION_TYPE_FILTERS: Array<{ value: SubmissionTypeFilter; label: string }> = [
  { value: "all", label: "Everything" },
  { value: "expense", label: "Expenses" },
  { value: "timesheet", label: "Timesheets" },
];

export const SUBMISSION_STATUS_FILTERS: Array<{ value: SubmissionStatusFilter; label: string }> = [
  { value: "all", label: "Any status" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "HELD", label: "Held" },
  { value: "APPROVED", label: "Approved" },
  { value: "REIMBURSED", label: "Reimbursed" },
  { value: "DECLINED", label: "Declined" },
];

const dayFmt = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function timesheetStatusLabel(status: TimesheetStatus): string {
  switch (status) {
    case "SUBMITTED":
      return "Submitted";
    case "APPROVED":
      return "Approved";
    case "DECLINED":
      return "Declined";
  }
}

export function timesheetStatusBadgeVariant(status: TimesheetStatus): SubmissionBadge {
  switch (status) {
    case "APPROVED":
      return "cleared";
    case "SUBMITTED":
      return "info";
    case "DECLINED":
      return "note";
  }
}

/** Sum the per-day hours as integer hundredths, so no float ever touches a total. */
export function totalTimesheetHours(entries: Pick<OwnTimesheetEntry, "hours">[]): string {
  const hundredths = entries.reduce((sum, entry) => sum + (parseHoursHundredths(entry.hours) ?? 0), 0);
  return formatHoursHundredths(hundredths);
}

export function weekLabel(weekStart: string): string {
  return `Week of ${dayFmt.format(new Date(weekStart))}`;
}

export function expenseRow(expense: OwnExpense, heldIds: Set<string> = new Set()): SubmissionRow {
  const status = effectiveExpenseStatus(expense, heldIds);
  return {
    kind: "expense",
    id: expense.id,
    href: `/employee/submissions/expense/${expense.id}`,
    submittedAt: expense.submittedAt,
    title: expense.merchantRaw,
    detail: `${expense.categoryId}, ${dayFmt.format(new Date(expense.incurredAt))}`,
    amountCents: expense.amountCents,
    hours: null,
    status,
    statusLabel: expenseStatusLabel(status),
    badge: expenseStatusBadgeVariant(status),
  };
}

export function timesheetRow(timesheet: OwnTimesheet): SubmissionRow {
  const hours = totalTimesheetHours(timesheet.entries);
  const dayCount = timesheet.entries.length;
  return {
    kind: "timesheet",
    id: timesheet.id,
    href: `/employee/submissions/timesheet/${timesheet.id}`,
    submittedAt: timesheet.submittedAt,
    title: weekLabel(timesheet.weekStart),
    detail: `${hours} hours over ${dayCount} ${dayCount === 1 ? "day" : "days"}`,
    amountCents: null,
    hours,
    status: timesheet.status,
    statusLabel: timesheetStatusLabel(timesheet.status),
    badge: timesheetStatusBadgeVariant(timesheet.status),
  };
}

/** Both kinds in one list, newest submission first. Holds decide which expenses read as paused. */
export function buildSubmissionRows(input: {
  expenses: OwnExpense[];
  timesheets: OwnTimesheet[];
  holds?: OwnHold[];
}): SubmissionRow[] {
  const heldIds = heldExpenseIds(input.holds ?? []);
  return [
    ...input.expenses.map((expense) => expenseRow(expense, heldIds)),
    ...input.timesheets.map(timesheetRow),
  ].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export function filterSubmissions(rows: SubmissionRow[], filters: SubmissionFilters): SubmissionRow[] {
  return rows.filter(
    (row) =>
      (filters.type === "all" || row.kind === filters.type) &&
      (filters.status === "all" || row.status === filters.status),
  );
}

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/** Anything unrecognised in the query string falls back to showing everything. */
export function parseSubmissionFilters(params: {
  type?: string | string[];
  status?: string | string[];
}): SubmissionFilters {
  const type = firstValue(params.type);
  const status = firstValue(params.status);
  return {
    type: SUBMISSION_TYPE_FILTERS.some((option) => option.value === type)
      ? (type as SubmissionTypeFilter)
      : "all",
    status: SUBMISSION_STATUS_FILTERS.some((option) => option.value === status)
      ? (status as SubmissionStatusFilter)
      : "all",
  };
}

export function submissionsHref(filters: SubmissionFilters): string {
  const query = new URLSearchParams();
  if (filters.type !== "all") query.set("type", filters.type);
  if (filters.status !== "all") query.set("status", filters.status);
  const search = query.toString();
  return search ? `/employee/submissions?${search}` : "/employee/submissions";
}
