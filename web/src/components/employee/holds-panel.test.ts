import { describe, expect, it } from "vitest";
import { REASONS } from "@/fixtures/employee";

describe("held reimbursement copy", () => {
  it("explains the pause and the next step without accusing", () => {
    expect(REASONS.holdBanner).toMatch(/paused while a reviewer looks at it/i);
    expect(REASONS.holdBanner).toMatch(/here is why/i);
    expect(REASONS.holdNext).toMatch(/reviewer/i);
  });
});
