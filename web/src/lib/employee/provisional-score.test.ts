import { describe, expect, it } from "vitest";
import { PENDING_CAP, provisionalScore } from "@/lib/employee/provisional-score";

const now = new Date("2026-09-20T12:00:00Z");

describe("provisionalScore", () => {
  it("is 100 with no findings", () => {
    const s = provisionalScore([], now);
    expect(s.value).toBe(100);
    expect(s.history).toHaveLength(6);
    expect(s.events).toEqual([]);
  });

  it("applies the pending factor to a fresh penalty", () => {
    const s = provisionalScore([{ findingId: "f1", points: 20, occurredAt: "2026-09-19T00:00:00Z", reason: "r" }], now);
    expect(s.value).toBe(93); // 100 - 20 * 0.35
    expect(s.events[0]?.delta).toBeCloseTo(-7, 0);
  });

  it("decays an old penalty", () => {
    const fresh = provisionalScore([{ findingId: "f", points: 30, occurredAt: "2026-09-19T00:00:00Z", reason: "" }], now);
    const old = provisionalScore([{ findingId: "f", points: 30, occurredAt: "2026-03-20T00:00:00Z", reason: "" }], now);
    expect(old.value).toBeGreaterThan(fresh.value);
  });

  it("caps the pending total at 15 points", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ findingId: `f${i}`, points: 30, occurredAt: "2026-09-19T00:00:00Z", reason: "" }));
    expect(provisionalScore(many, now).value).toBe(100 - PENDING_CAP);
  });

  it("only counts a finding from the month it happened", () => {
    const s = provisionalScore([{ findingId: "f", points: 30, occurredAt: "2026-08-10T00:00:00Z", reason: "" }], now);
    expect(s.history[0]?.value).toBe(100);
    expect(s.history[5]?.value).toBeLessThan(100);
  });
});
