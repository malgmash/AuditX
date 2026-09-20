import { describe, expect, it } from "vitest";
import { diffCorrectedFields } from "./corrected-fields";
import type { ExpenseExtraction } from "@/contracts/employee";

const extraction: ExpenseExtraction = {
  merchantName: { value: "Union Hall Coffee", confidence: 0.95 },
  transactionDate: { value: "2026-09-09", confidence: 0.62 },
  totalCents: { value: 1280, confidence: 0.97 },
  merchantCity: null,
  transactionTime: null,
  legibility: 0.9,
  correctedFields: [],
};

describe("diffCorrectedFields", () => {
  it("records fields the employee changed after prefill", () => {
    expect(
      diffCorrectedFields(extraction, {
        merchantRaw: "Union Hall",
        incurredOn: "2026-09-09",
        amountCents: 1280,
      }),
    ).toEqual(["merchantName"]);
  });

  it("returns nothing when the employee kept the extracted values", () => {
    expect(
      diffCorrectedFields(extraction, {
        merchantRaw: "Union Hall Coffee",
        incurredOn: "2026-09-09",
        amountCents: 1280,
      }),
    ).toEqual([]);
  });
});
