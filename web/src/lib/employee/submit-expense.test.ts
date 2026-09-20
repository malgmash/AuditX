import { describe, expect, it } from "vitest";
import { HttpError } from "@/lib/auth/http";
import { FIXTURE_EMPLOYEE_IDS } from "@/fixtures/employee";
import { createFixtureEmployeeRepo } from "@/fixtures/employee/repo";
import { createLiveExtractProvider, createMockExtractProvider } from "@/lib/employee/extract";
import { createMemoryReceiptStorage } from "@/lib/employee/receipt-file";
import { submitEmployeeExpense } from "@/lib/employee/submit-expense";
import type { SessionUser } from "@/lib/auth/session";

const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const heldUser: SessionUser = {
  id: "db-jamie",
  role: "EMPLOYEE",
  name: "Jamie Okafor",
  email: "employee@auditx.local",
  department: "Sales",
};

function receiptFile(name = "receipt.png"): File {
  return new File([PNG_1x1], name, { type: "image/png" });
}

function form(overrides: Record<string, string | File> = {}): FormData {
  const fd = new FormData();
  fd.set("merchantRaw", "Union Hall Coffee");
  fd.set("incurredOn", "2026-09-09");
  fd.set("categoryId", "Meals");
  fd.set("amount", "12.34");
  fd.set("description", "Team lunch");
  fd.set("receipt", receiptFile());
  for (const [key, value] of Object.entries(overrides)) {
    fd.set(key, value);
  }
  return fd;
}

describe("submitEmployeeExpense", () => {
  it("stores $12.34, $0.10 and $1,000.00 as integer cents", async () => {
    const repo = createFixtureEmployeeRepo();
    const storage = createMemoryReceiptStorage();
    const cases = [
      { amount: "12.34", cents: 1234 },
      { amount: "$0.10", cents: 10 },
      { amount: "$1,000.00", cents: 100000 },
    ];
    for (const row of cases) {
      const result = await submitEmployeeExpense({
        user: heldUser,
        form: form({ amount: row.amount, receipt: receiptFile(`${row.cents}.png`) }),
        repo,
        storage,
        extract: createMockExtractProvider(),
      });
      expect(result.expense.amountCents).toBe(row.cents);
      expect(Number.isInteger(result.expense.amountCents)).toBe(true);
    }
  });

  it("writes the expense as the session user, ignoring another user id in the body", async () => {
    const repo = createFixtureEmployeeRepo();
    const result = await submitEmployeeExpense({
      user: heldUser,
      form: form({ userId: FIXTURE_EMPLOYEE_IDS.clean }),
      repo,
      storage: createMemoryReceiptStorage(),
      extract: createMockExtractProvider(),
    });
    expect(result.expense.userId).toBe(FIXTURE_EMPLOYEE_IDS.held);
    const mine = await repo.listExpenses(FIXTURE_EMPLOYEE_IDS.held);
    const theirs = await repo.listExpenses(FIXTURE_EMPLOYEE_IDS.clean);
    expect(mine.some((row) => row.id === result.expense.id)).toBe(true);
    expect(theirs.some((row) => row.id === result.expense.id)).toBe(false);
  });

  it("records edited extraction fields and still appears in the acting user's list", async () => {
    const repo = createFixtureEmployeeRepo();
    const extraction = {
      merchantName: { value: "Union Hall Coffee", confidence: 0.95 },
      transactionDate: { value: "2026-09-09", confidence: 0.62 },
      totalCents: { value: 1280, confidence: 0.97 },
      merchantCity: null,
      transactionTime: null,
      legibility: 0.9,
      correctedFields: [],
    };
    const result = await submitEmployeeExpense({
      user: heldUser,
      form: form({
        merchantRaw: "Union Hall",
        amount: "12.80",
        extraction: JSON.stringify(extraction),
      }),
      repo,
      storage: createMemoryReceiptStorage(),
      extract: createMockExtractProvider(),
    });
    expect(result.expense.extraction?.correctedFields).toEqual(["merchantName"]);
    expect(result.expense.receipt?.sha256).toHaveLength(64);
    const list = await repo.listExpenses(FIXTURE_EMPLOYEE_IDS.held);
    expect(list[0]?.id).toBe(result.expense.id);
  });

  it("still succeeds with entered fields when extraction is unreachable", async () => {
    const repo = createFixtureEmployeeRepo();
    const result = await submitEmployeeExpense({
      user: heldUser,
      form: form({ amount: "12.34" }),
      repo,
      storage: createMemoryReceiptStorage(),
      extract: createLiveExtractProvider({
        baseUrl: "http://127.0.0.1:9",
        fetchImpl: async () => {
          throw new Error("ECONNREFUSED");
        },
      }),
    });
    expect(result.fallback).toBe(true);
    expect(result.expense.amountCents).toBe(1234);
    expect(result.expense.merchantRaw).toBe("Union Hall Coffee");
    expect(result.expense.extraction).toBeNull();
    expect(result.expense.status).toBe("SUBMITTED");
  });

  it("accepts a blank description", async () => {
    const result = await submitEmployeeExpense({
      user: heldUser,
      form: form({ description: "" }),
      repo: createFixtureEmployeeRepo(),
      storage: createMemoryReceiptStorage(),
      extract: createMockExtractProvider(),
    });
    expect(result.expense.description).toBe("");
    expect(result.expense.status).toBe("SUBMITTED");
  });

  it("rejects a missing receipt", async () => {
    const fd = form();
    fd.delete("receipt");
    await expect(
      submitEmployeeExpense({
        user: heldUser,
        form: fd,
        repo: createFixtureEmployeeRepo(),
        storage: createMemoryReceiptStorage(),
        extract: createMockExtractProvider(),
      }),
    ).rejects.toBeInstanceOf(HttpError);
  });
});
