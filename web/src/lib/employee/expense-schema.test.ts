import { describe, expect, it } from "vitest";
import { centsToAmountInput, expenseFormSchema, parseAmountCents } from "./expense-schema";

describe("parseAmountCents", () => {
  it("stores typed dollars as integer cents", () => {
    expect(parseAmountCents("12.34")).toBe(1234);
    expect(parseAmountCents("$0.10")).toBe(10);
    expect(parseAmountCents("$1,000.00")).toBe(100000);
  });

  it("rejects amounts that are not two-decimal dollars", () => {
    expect(parseAmountCents("1.234")).toBeNull();
    expect(parseAmountCents("")).toBeNull();
  });
});

describe("expenseFormSchema", () => {
  it("allows a blank description", () => {
    const parsed = expenseFormSchema.safeParse({
      merchantRaw: "Union Hall Coffee",
      incurredOn: "2026-09-09",
      categoryId: "Meals",
      amount: "12.34",
      description: "",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.description).toBe("");
  });
});

describe("centsToAmountInput", () => {
  it("formats cents for the amount field without a currency sign", () => {
    expect(centsToAmountInput(1234)).toBe("12.34");
    expect(centsToAmountInput(10)).toBe("0.10");
    expect(centsToAmountInput(100000)).toBe("1000.00");
  });
});
