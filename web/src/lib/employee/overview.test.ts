import { describe, expect, it } from "vitest";
import { FIXTURE_EMPLOYEE_IDS } from "@/fixtures/employee";
import { createFixtureEmployeeRepo } from "@/fixtures/employee/repo";
import { summarizeRecord } from "./overview";

describe("summarizeRecord", () => {
  it("counts score, holds, paused cents and expense states for the held fixture", async () => {
    const repo = createFixtureEmployeeRepo();
    const overview = await repo.getOverview(FIXTURE_EMPLOYEE_IDS.held);
    const expenses = await repo.listExpenses(FIXTURE_EMPLOYEE_IDS.held);
    expect(overview).not.toBeNull();
    if (!overview) return;

    const summary = summarizeRecord({
      score: overview.score.value,
      expenses,
      holds: overview.holds,
    });

    expect(summary.score).toBe(23);
    expect(summary.holdCount).toBe(1);
    expect(summary.pausedCents).toBe(4720);
    expect(summary.expenseCount).toBe(expenses.length);
    expect(summary.approvedCount).toBeGreaterThan(0);
    expect(summary.statusCounts.find((row) => row.status === "HELD")?.count).toBe(1);
  });
});
