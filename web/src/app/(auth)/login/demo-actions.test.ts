import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/auth", () => ({ signIn: vi.fn() }));
vi.mock("next-auth", () => ({ AuthError: class AuthError extends Error {} }));

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { demoLogin } from "./actions";

const form = (role: string) => {
  const fd = new FormData();
  fd.set("role", role);
  return fd;
};

describe("demo sign-in", () => {
  beforeEach(() => {
    vi.mocked(signIn).mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("signs the administrator in and sends them to /admin", async () => {
    vi.mocked(signIn).mockResolvedValue(undefined as never);
    await demoLogin({}, form("admin"));
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "admin@auditx.local",
      password: "AuditX-admin-2026",
      redirectTo: "/admin",
    });
  });

  it("signs the employee in and sends them to /employee", async () => {
    vi.mocked(signIn).mockResolvedValue(undefined as never);
    await demoLogin({}, form("employee"));
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "employee@auditx.local",
      password: "AuditX-employee-2026",
      redirectTo: "/employee",
    });
  });

  it("refuses any other role, so a request cannot pick an account", async () => {
    const result = await demoLogin({}, form("someone-else"));
    expect(result.error).toBeTruthy();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("does nothing when DEMO_LOGIN is off", async () => {
    vi.stubEnv("DEMO_LOGIN", "off");
    const result = await demoLogin({}, form("admin"));
    expect(result.error).toBe("Demo sign-in is switched off.");
    expect(signIn).not.toHaveBeenCalled();
  });

  it("gives a plain message if the sample account cannot sign in", async () => {
    vi.mocked(signIn).mockRejectedValue(new AuthError("CredentialsSignin"));
    const result = await demoLogin({}, form("admin"));
    expect(result.error).toMatch(/not available/);
  });
});
