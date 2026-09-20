import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.77" }) }));
vi.mock("@/auth", () => ({ signIn: vi.fn() }));
// next-auth cannot be loaded under Vitest, so stand in for its error class.
vi.mock("next-auth", () => ({ AuthError: class AuthError extends Error {} }));

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { login } from "./actions";

const PROBE = "Probe-Password-Never-Logged-4471";

function form(email: string, password: string) {
  const fd = new FormData();
  fd.set("email", email);
  fd.set("password", password);
  return fd;
}

describe("login action", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_RATE_LIMIT", "on");
    vi.mocked(signIn).mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("gives one generic message for a failed sign-in and never echoes or logs the password", async () => {
    vi.mocked(signIn).mockRejectedValue(new AuthError("CredentialsSignin"));
    const logs = [vi.spyOn(console, "log"), vi.spyOn(console, "error"), vi.spyOn(console, "warn"), vi.spyOn(console, "info")];
    const result = await login({}, form("generic.failure@example.com", PROBE));
    expect(result).toEqual({ error: "Email or password is incorrect" });
    expect(JSON.stringify(result)).not.toContain(PROBE);
    expect(JSON.stringify(logs.flatMap((l) => l.mock.calls))).not.toContain(PROBE);
    logs.forEach((l) => l.mockRestore());
  });

  it("stops asking Auth.js after too many failures and says how long to wait", async () => {
    vi.mocked(signIn).mockRejectedValue(new AuthError("CredentialsSignin"));
    // The email counter is filled by authorize() in the real app. Fill it the same way here.
    const { loginThrottle } = await import("@/lib/auth/rate-limit");
    for (let i = 0; i < 5; i++) loginThrottle.fail("locked.out@example.com");
    const result = await login({}, form("locked.out@example.com", PROBE));
    expect(result.error).toMatch(/^Too many attempts\. Try again in \d+ minutes?\.$/);
    expect(signIn).not.toHaveBeenCalled();
  });
});
