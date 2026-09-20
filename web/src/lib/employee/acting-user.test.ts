import { afterEach, describe, expect, it, vi } from "vitest";
import { FIXTURE_EMPLOYEE_IDS } from "@/fixtures/employee";

describe("resolveActingUserId", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("maps the demo employee login to the held fixture", async () => {
    vi.stubEnv("AUDITX_DATA", "fixtures");
    const { resolveActingUserId } = await import("./acting-user");
    expect(
      resolveActingUserId({ id: "db-user-1", email: "employee@auditx.local" }),
    ).toBe(FIXTURE_EMPLOYEE_IDS.held);
  });

  it("honours AUDITX_FIXTURE_USER for the clean empty-state fixture", async () => {
    vi.stubEnv("AUDITX_DATA", "fixtures");
    vi.stubEnv("AUDITX_FIXTURE_USER", FIXTURE_EMPLOYEE_IDS.clean);
    const { resolveActingUserId } = await import("./acting-user");
    expect(
      resolveActingUserId({ id: "db-user-1", email: "employee@auditx.local" }),
    ).toBe(FIXTURE_EMPLOYEE_IDS.clean);
  });
});
