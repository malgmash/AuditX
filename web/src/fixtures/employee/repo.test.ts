import { describe, expect, it } from "vitest";
import { FIXTURE_EMPLOYEE_IDS } from "./data";
import { createFixtureEmployeeRepo } from "./repo";

describe("employee fixture repository", () => {
  it("scopes every read to the acting user id", async () => {
    const repo = createFixtureEmployeeRepo();
    const heldExpense = await repo.getExpense(FIXTURE_EMPLOYEE_IDS.clean, "exp_dup_resubmit");
    const heldFinding = await repo.getFinding(FIXTURE_EMPLOYEE_IDS.clean, "fnd_dup");
    const heldTimesheet = await repo.getTimesheet(FIXTURE_EMPLOYEE_IDS.clean, "ts_held_conflict");

    expect(heldExpense).toBeNull();
    expect(heldFinding).toBeNull();
    expect(heldTimesheet).toBeNull();

    const cleanExpenses = await repo.listExpenses(FIXTURE_EMPLOYEE_IDS.clean);
    expect(cleanExpenses.every((e) => e.userId === FIXTURE_EMPLOYEE_IDS.clean)).toBe(true);
    expect(cleanExpenses.some((e) => e.id === "exp_dup_resubmit")).toBe(false);
  });

  it("gives the held employee an active hold with a plain reason", async () => {
    const repo = createFixtureEmployeeRepo();
    const overview = await repo.getOverview(FIXTURE_EMPLOYEE_IDS.held);
    expect(overview).not.toBeNull();
    expect(overview?.holds).toHaveLength(1);
    expect(overview?.holds[0]?.reason).toMatch(/paused while a reviewer looks at it/i);
    expect(overview?.score.history).toHaveLength(6);
  });

  it("gives the remote-work employee no findings", async () => {
    const repo = createFixtureEmployeeRepo();
    const findings = await repo.listFindings(FIXTURE_EMPLOYEE_IDS.remote);
    const overview = await repo.getOverview(FIXTURE_EMPLOYEE_IDS.remote);
    expect(findings).toEqual([]);
    expect(overview?.holds).toEqual([]);
    const chicagoDay = (await repo.getTimesheet(FIXTURE_EMPLOYEE_IDS.remote, "ts_remote_chicago"))
      ?.entries.find((e) => e.workDate.startsWith("2026-09-08"));
    expect(chicagoDay?.location).toBe("Chicago");
  });

  it("writes created expenses as the acting user, never another id", async () => {
    const repo = createFixtureEmployeeRepo();
    const created = await repo.createExpense(FIXTURE_EMPLOYEE_IDS.clean, {
      incurredAt: "2026-09-18T12:00:00.000Z",
      merchantRaw: "Union Hall Coffee",
      categoryId: "Meals",
      amountCents: 900,
      description: "Coffee",
      receipt: null,
      extraction: null,
    });
    expect(created.userId).toBe(FIXTURE_EMPLOYEE_IDS.clean);
    expect(created.amountCents).toBe(900);
    expect(created.status).toBe("SUBMITTED");

    const otherList = await repo.listExpenses(FIXTURE_EMPLOYEE_IDS.held);
    expect(otherList.some((e) => e.id === created.id)).toBe(false);
  });
});
