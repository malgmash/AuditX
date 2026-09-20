import { describe, expect, it } from "vitest";
import { FIXTURE_EMPLOYEE_IDS } from "@/fixtures/employee";
import { createFixtureEmployeeRepo } from "@/fixtures/employee/repo";
import { loadExpenseDetail, loadTimesheetDetail } from "@/lib/employee/submission-detail";
import {
  buildSubmissionRows,
  filterSubmissions,
  parseSubmissionFilters,
  submissionsHref,
  totalTimesheetHours,
  weekLabel,
} from "@/lib/employee/submissions";

async function rowsFor(userId: string) {
  const repo = createFixtureEmployeeRepo();
  const [expenses, timesheets] = await Promise.all([
    repo.listExpenses(userId),
    repo.listTimesheets(userId),
  ]);
  return buildSubmissionRows({ expenses, timesheets });
}

describe("submission rows", () => {
  it("lists both kinds newest first", async () => {
    const rows = await rowsFor(FIXTURE_EMPLOYEE_IDS.held);
    const stamps = rows.map((row) => row.submittedAt);
    expect([...stamps].sort((a, b) => b.localeCompare(a))).toEqual(stamps);
    expect(new Set(rows.map((row) => row.kind))).toEqual(new Set(["expense", "timesheet"]));
  });

  it("shows only the acting user's items", async () => {
    const held = await rowsFor(FIXTURE_EMPLOYEE_IDS.held);
    const clean = await rowsFor(FIXTURE_EMPLOYEE_IDS.clean);
    const heldIds = new Set(held.map((row) => row.id));
    expect(clean.every((row) => !heldIds.has(row.id))).toBe(true);
    expect(held.some((row) => row.id === "ts_held_conflict")).toBe(true);
    expect(clean.some((row) => row.id === "ts_held_conflict")).toBe(false);
  });

  it("carries the amount for an expense and the hours for a timesheet", async () => {
    const rows = await rowsFor(FIXTURE_EMPLOYEE_IDS.clean);
    const expense = rows.find((row) => row.kind === "expense");
    const timesheet = rows.find((row) => row.kind === "timesheet");
    expect(expense?.amountCents).toBeGreaterThan(0);
    expect(expense?.hours).toBeNull();
    expect(timesheet?.amountCents).toBeNull();
    expect(timesheet?.hours).toBe("40.00");
  });

  it("filters by type and by status", async () => {
    const rows = await rowsFor(FIXTURE_EMPLOYEE_IDS.held);
    const timesheets = filterSubmissions(rows, { type: "timesheet", status: "all" });
    expect(timesheets.every((row) => row.kind === "timesheet")).toBe(true);

    const held = filterSubmissions(rows, { type: "all", status: "HELD" });
    expect(held.length).toBeGreaterThan(0);
    expect(held.every((row) => row.status === "HELD")).toBe(true);

    const none = filterSubmissions(rows, { type: "timesheet", status: "HELD" });
    expect(none).toEqual([]);
  });
});

describe("filter parsing", () => {
  it("keeps recognised values", () => {
    expect(parseSubmissionFilters({ type: "expense", status: "HELD" })).toEqual({
      type: "expense",
      status: "HELD",
    });
  });

  it("falls back to everything for anything unrecognised", () => {
    expect(parseSubmissionFilters({ type: "wat", status: "PENDING" })).toEqual({
      type: "all",
      status: "all",
    });
    expect(parseSubmissionFilters({})).toEqual({ type: "all", status: "all" });
  });

  it("builds a href that leaves defaults out of the query string", () => {
    expect(submissionsHref({ type: "all", status: "all" })).toBe("/employee/submissions");
    expect(submissionsHref({ type: "timesheet", status: "APPROVED" })).toBe(
      "/employee/submissions?type=timesheet&status=APPROVED",
    );
  });
});

describe("timesheet totals", () => {
  it("sums hours as integer hundredths", () => {
    expect(totalTimesheetHours([{ hours: "8.00" }, { hours: "7.50" }, { hours: "0.25" }])).toBe("15.75");
  });

  it("labels the week by its Monday in UTC", () => {
    expect(weekLabel("2026-09-07T00:00:00.000Z")).toBe("Week of Sep 7, 2026");
  });
});

describe("detail loading", () => {
  it("returns the item for its owner", async () => {
    const repo = createFixtureEmployeeRepo();
    const expense = await loadExpenseDetail(FIXTURE_EMPLOYEE_IDS.held, "exp_chicago_lunch", repo);
    const timesheet = await loadTimesheetDetail(FIXTURE_EMPLOYEE_IDS.held, "ts_held_conflict", repo);
    expect(expense?.expense.merchantRaw).toBe("Lou Malnati's");
    expect(timesheet?.timesheet.entries.length).toBe(5);
  });

  it("returns null for another user's id, so the page can answer 404", async () => {
    const repo = createFixtureEmployeeRepo();
    expect(await loadExpenseDetail(FIXTURE_EMPLOYEE_IDS.clean, "exp_chicago_lunch", repo)).toBeNull();
    expect(await loadTimesheetDetail(FIXTURE_EMPLOYEE_IDS.clean, "ts_held_conflict", repo)).toBeNull();
  });

  it("returns null for an id that does not exist", async () => {
    const repo = createFixtureEmployeeRepo();
    expect(await loadExpenseDetail(FIXTURE_EMPLOYEE_IDS.held, "exp_nope", repo)).toBeNull();
    expect(await loadTimesheetDetail(FIXTURE_EMPLOYEE_IDS.held, "ts_nope", repo)).toBeNull();
  });
});
