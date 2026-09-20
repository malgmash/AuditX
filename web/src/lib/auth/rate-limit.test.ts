import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SlidingWindow, clientIp, loginThrottle, registerThrottle, tooManyMessage } from "./rate-limit";

describe("SlidingWindow", () => {
  it("blocks after the maximum and reports how long to wait", () => {
    const w = new SlidingWindow(3, 60_000);
    for (let i = 0; i < 3; i++) w.record("k", 1_000);
    const gate = w.check("k", 1_000);
    expect(gate).toEqual({ blocked: true, retryAfterSeconds: 60 });
  });

  it("lets attempts through again once the window has passed", () => {
    const w = new SlidingWindow(2, 60_000);
    w.record("k", 0);
    w.record("k", 0);
    expect(w.check("k", 30_000).blocked).toBe(true);
    expect(w.check("k", 60_001).blocked).toBe(false);
  });

  it("keeps keys apart", () => {
    const w = new SlidingWindow(1, 60_000);
    w.record("a", 0);
    expect(w.check("a", 1).blocked).toBe(true);
    expect(w.check("b", 1).blocked).toBe(false);
  });
});

describe("loginThrottle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-20T12:00:00Z"));
    vi.stubEnv("AUTH_RATE_LIMIT", "on");
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("throttles repeated failed sign-ins for one email, and a success clears the count", () => {
    const email = "throttle.one@example.com";
    for (let i = 0; i < 5; i++) loginThrottle.fail(email);
    const gate = loginThrottle.check(email);
    expect(gate.blocked).toBe(true);
    loginThrottle.succeed(email);
    expect(loginThrottle.check(email).blocked).toBe(false);
  });

  it("throttles one address across many emails", () => {
    for (let i = 0; i < 20; i++) loginThrottle.failAddress("203.0.113.9");
    expect(loginThrottle.check("someone.new@example.com", "203.0.113.9").blocked).toBe(true);
    expect(loginThrottle.check("someone.new@example.com", "198.51.100.1").blocked).toBe(false);
  });

  it("can be switched off for a rehearsal", () => {
    const email = "throttle.off@example.com";
    for (let i = 0; i < 9; i++) loginThrottle.fail(email);
    vi.stubEnv("AUTH_RATE_LIMIT", "off");
    expect(loginThrottle.check(email).blocked).toBe(false);
  });

  it("names the wait in minutes without revealing whether the account exists", () => {
    const email = "throttle.msg@example.com";
    for (let i = 0; i < 5; i++) loginThrottle.fail(email);
    const gate = loginThrottle.check(email);
    if (!gate.blocked) throw new Error("expected a block");
    expect(tooManyMessage(gate)).toMatch(/^Too many attempts\. Try again in \d+ minutes?\.$/);
  });
});

describe("registerThrottle", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("allows a few sign-ups per email, then blocks", () => {
    vi.stubEnv("AUTH_RATE_LIMIT", "on");
    const email = "Signup.Repeat@example.com";
    for (let i = 0; i < 5; i++) expect(registerThrottle.attempt(email).blocked).toBe(false);
    expect(registerThrottle.attempt("signup.repeat@example.com").blocked).toBe(true);
  });
});

describe("clientIp", () => {
  it("takes the first forwarded address", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" });
    expect(clientIp(h)).toBe("203.0.113.5");
  });
  it("is undefined without proxy headers", () => {
    expect(clientIp(new Headers())).toBeUndefined();
  });
});
