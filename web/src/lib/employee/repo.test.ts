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

  it("rejects db until section 7", async () => {
    vi.stubEnv("AUDITX_DATA", "db");
    const { getEmployeeRepo, employeeDataMode } = await import("./repo");
    expect(employeeDataMode()).toBe("db");
    expect(() => getEmployeeRepo()).toThrow(/AUDITX_DATA=fixtures/);
  });
});
