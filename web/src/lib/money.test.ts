import { describe, expect, it } from "vitest";
import { dollarsToCents, formatCents } from "./money";

describe("dollarsToCents", () => {
  it("converts typed amounts without floating point error", () => {
    expect(dollarsToCents("12.34")).toBe(1234);
    expect(dollarsToCents("0.10")).toBe(10);
    expect(dollarsToCents("0.1")).toBe(10);
    expect(dollarsToCents("$1,000.00")).toBe(100000);
    expect(dollarsToCents("5")).toBe(500);
    expect(dollarsToCents("1.15")).toBe(115);
  });

  it("rejects malformed amounts", () => {
    expect(dollarsToCents("")).toBeNull();
    expect(dollarsToCents("abc")).toBeNull();
    expect(dollarsToCents("1.234")).toBeNull();
    expect(dollarsToCents("-5")).toBeNull();
  });
});

describe("formatCents", () => {
  it("formats integer cents", () => {
    expect(formatCents(320000)).toBe("$3,200.00");
    expect(formatCents(450)).toBe("$4.50");
    expect(formatCents(-1234)).toBe("-$12.34");
  });

  it("refuses fractional cents", () => {
    expect(() => formatCents(1.5)).toThrow();
  });
});
