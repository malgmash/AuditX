import { describe, expect, it } from "vitest";
import { HttpError } from "@/lib/auth/http";
import { FIXTURE_EMPLOYEE_IDS } from "@/fixtures/employee";
import { createFixtureEmployeeRepo } from "@/fixtures/employee/repo";
import { submitEmployeeTimesheet } from "@/lib/employee/submit-timesheet";
import type { SessionUser } from "@/lib/auth/session";

const heldUser: SessionUser = {
  id: "db-jamie",
  role: "EMPLOYEE",
  name: "Jamie Okafor",
  email: "employee@auditx.local",
  department: "Sales",
};

function weekBody(overrides: Record<string, unknown> = {}) {
  return {
    weekStart: "2026-09-14",
    entries: [
      {
        workDate: "2026-09-14",
        startTime: "09:00",
        endTime: "17:00",
        hours: "8.00",
        project: "Core",
        location: "Pittsburgh office",
      },
      {
        workDate: "2026-09-15",
        startTime: "09:00",
        endTime: "17:00",
        hours: "8.00",
        project: "Core",
        location: "remote",
      },
      {
        workDate: "2026-09-16",
        startTime: "10:00",
        endTime: "16:30",
        hours: "6.50",
        project: "Core",
        location: "Chicago",
      },
    ],
    ...overrides,
  };
}

describe("submitEmployeeTimesheet", () => {
  it("writes the week for the session user and lists it as theirs", async () => {
    const repo = createFixtureEmployeeRepo();
    const result = await submitEmployeeTimesheet({ user: heldUser, body: weekBody(), repo });
    expect(result.userId).toBe(FIXTURE_EMPLOYEE_IDS.held);
    expect(result.status).toBe("SUBMITTED");
    expect(result.weekStart).toBe("2026-09-14T00:00:00.000Z");
    expect(result.entries).toHaveLength(3);
    expect(result.entries[1]?.location).toBe("remote");
    expect(result.entries[2]?.location).toBe("Chicago");
    expect(result.entries[2]?.hours).toBe("6.50");
    const listed = await repo.listTimesheets(FIXTURE_EMPLOYEE_IDS.held);
    expect(listed.some((row) => row.id === result.id)).toBe(true);
    const other = await repo.listTimesheets(FIXTURE_EMPLOYEE_IDS.clean);
    expect(other.some((row) => row.id === result.id)).toBe(false);
  });

  it("ignores another user id in the body", async () => {
    const repo = createFixtureEmployeeRepo();
    const result = await submitEmployeeTimesheet({
      user: heldUser,
      body: { ...weekBody(), userId: FIXTURE_EMPLOYEE_IDS.clean },
      repo,
    });
    expect(result.userId).toBe(FIXTURE_EMPLOYEE_IDS.held);
  });

  it("rejects a week that does not start on Monday", async () => {
    await expect(
      submitEmployeeTimesheet({
        user: heldUser,
        body: weekBody({ weekStart: "2026-09-15" }),
        repo: createFixtureEmployeeRepo(),
      }),
    ).rejects.toMatchObject({ status: 422, message: "The week must start on a Monday." } satisfies Partial<HttpError>);
  });

  it("rejects an end time that is not after start", async () => {
    await expect(
      submitEmployeeTimesheet({
        user: heldUser,
        body: weekBody({
          entries: [
            {
              workDate: "2026-09-14",
              startTime: "17:00",
              endTime: "09:00",
              hours: "8.00",
              project: "Core",
              location: "Pittsburgh office",
            },
          ],
        }),
        repo: createFixtureEmployeeRepo(),
      }),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it("rejects hours that do not match the times", async () => {
    await expect(
      submitEmployeeTimesheet({
        user: heldUser,
        body: weekBody({
          entries: [
            {
              workDate: "2026-09-14",
              startTime: "09:00",
              endTime: "17:00",
              hours: "7.00",
              project: "Core",
              location: "Pittsburgh office",
            },
          ],
        }),
        repo: createFixtureEmployeeRepo(),
      }),
    ).rejects.toBeInstanceOf(HttpError);
  });
});
