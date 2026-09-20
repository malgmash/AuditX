/**
 * In-memory sliding-window limits for sign-in and sign-up. State lives in this server process, so
 * it resets on restart and is not shared between instances. That is enough for one demo server;
 * a multi-instance deployment needs a shared store. Set AUTH_RATE_LIMIT=off to disable, for
 * example while rehearsing a demo.
 */

export type Gate = { blocked: false } | { blocked: true; retryAfterSeconds: number };

export class SlidingWindow {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  private live(key: string, now: number): number[] {
    const kept = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (kept.length) this.hits.set(key, kept);
    else this.hits.delete(key);
    return kept;
  }

  check(key: string, now = Date.now()): Gate {
    const kept = this.live(key, now);
    if (kept.length < this.max) return { blocked: false };
    const oldest = kept[0]!;
    return { blocked: true, retryAfterSeconds: Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000)) };
  }

  record(key: string, now = Date.now()): void {
    const kept = this.live(key, now);
    kept.push(now);
    this.hits.set(key, kept);
  }

  clear(key: string): void {
    this.hits.delete(key);
  }
}

const MINUTE = 60_000;

function enabled(): boolean {
  return process.env.AUTH_RATE_LIMIT !== "off";
}

type Limiters = { loginEmail: SlidingWindow; loginIp: SlidingWindow; registerEmail: SlidingWindow; registerIp: SlidingWindow };

const g = globalThis as unknown as { __authLimiters?: Limiters };
const limiters: Limiters =
  (g.__authLimiters ??= {
    loginEmail: new SlidingWindow(5, 15 * MINUTE), // failed sign-ins per email
    loginIp: new SlidingWindow(20, 15 * MINUTE), // failed sign-ins per address
    registerEmail: new SlidingWindow(5, 60 * MINUTE), // sign-up attempts per email
    registerIp: new SlidingWindow(10, 60 * MINUTE), // sign-up attempts per address
  });

function worst(...gates: Gate[]): Gate {
  const blocked = gates.filter((x): x is Extract<Gate, { blocked: true }> => x.blocked);
  if (blocked.length === 0) return { blocked: false };
  return { blocked: true, retryAfterSeconds: Math.max(...blocked.map((b) => b.retryAfterSeconds)) };
}

export function tooManyMessage(gate: Extract<Gate, { blocked: true }>): string {
  const minutes = Math.ceil(gate.retryAfterSeconds / 60);
  return `Too many attempts. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
}

export const loginThrottle = {
  check(email: string, ip?: string): Gate {
    if (!enabled()) return { blocked: false };
    return worst(limiters.loginEmail.check(email), ip ? limiters.loginIp.check(ip) : { blocked: false });
  },
  fail(email: string, ip?: string): void {
    limiters.loginEmail.record(email);
    if (ip) limiters.loginIp.record(ip);
  },
  failAddress(ip: string): void {
    limiters.loginIp.record(ip);
  },
  succeed(email: string): void {
    limiters.loginEmail.clear(email);
  },
};

export const registerThrottle = {
  /** Counts the attempt and reports whether it is allowed. Every sign-up attempt counts. */
  attempt(email: string, ip?: string): Gate {
    if (!enabled()) return { blocked: false };
    const gate = worst(
      limiters.registerEmail.check(email.trim().toLowerCase()),
      ip ? limiters.registerIp.check(ip) : { blocked: false },
    );
    if (!gate.blocked) {
      limiters.registerEmail.record(email.trim().toLowerCase());
      if (ip) limiters.registerIp.record(ip);
    }
    return gate;
  },
};

/** The caller's address from the proxy headers, or undefined when there are none (local dev). */
export function clientIp(headers: { get(name: string): string | null }): string | undefined {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || undefined;
}
