import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { loadOwnExpense, ownExpenseWhere } from "./own-expense";

vi.mock("@/lib/db", () => ({
  db: {
    expense: {
      findFirst: vi.fn(),
    },
  },
}));

const findFirst = vi.mocked(db.expense.findFirst);

const theirs = {
  id: "exp_other",
  userId: "user_b",
  submittedAt: new Date("2026-03-03T00:00:00.000Z"),
  incurredAt: new Date("2026-03-02T00:00:00.000Z"),
  merchantRaw: "Conference ticket",
  merchantId: null,
  categoryId: "travel",
  amountCents: 3200_00,
  currency: "USD",
  description: "Annual conference",
  receiptId: null,
  status: "SUBMITTED" as const,
  extraction: null,
};

describe("ownExpenseWhere", () => {
  it("always includes the signed-in user, so an edited URL id cannot select another row", () => {
    expect(ownExpenseWhere("user_a", "exp_other")).toEqual({ id: "exp_other", userId: "user_a" });
  });
});

describe("loadOwnExpense", () => {
  beforeEach(() => {
    findFirst.mockReset();
  });

  it("returns 404 when an employee changes the expense id in the URL to someone else's", async () => {
    findFirst.mockResolvedValue(null);
    await expect(loadOwnExpense("user_a", "exp_other")).rejects.toMatchObject({
      status: 404,
      message: "Not found",
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "exp_other", userId: "user_a" },
      }),
    );
  });

  it("returns the row only for its owner", async () => {
    findFirst.mockResolvedValue(theirs);
    await expect(loadOwnExpense("user_b", "exp_other")).resolves.toMatchObject({
      id: "exp_other",
      userId: "user_b",
    });
  });
});
