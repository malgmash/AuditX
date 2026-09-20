import { afterEach, describe, expect, it, vi } from "vitest";

describe("getEmployeeRepo", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("returns the fixture implementation by default", async () => {
    vi.stubEnv("AUDITX_DATA", "fixtures");
    const { getEmployeeRepo, employeeDataMode } = await import("./repo");
    expect(employeeDataMode()).toBe("fixtures");
    expect(getEmployeeRepo()).toBeDefined();
  });

  it("returns the database implementation when AUDITX_DATA=db", async () => {
    vi.stubEnv("AUDITX_DATA", "db");
    const { getEmployeeRepo, employeeDataMode } = await import("./repo");
    expect(employeeDataMode()).toBe("db");
    expect(getEmployeeRepo()).toBeDefined();
    expect(getEmployeeRepo()).not.toBe((await import("@/fixtures/employee")).fixtureEmployeeRepo);
  });
});
