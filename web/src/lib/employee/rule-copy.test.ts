import { describe, expect, it } from "vitest";
import { KNOWN_RULE_IDS, ruleCopy } from "@/lib/employee/rule-copy";

const BANNED = /\b(fraud\w*|theft|steal\w*|dishonest\w*|guilty)\b/i;

describe("ruleCopy", () => {
  it("covers all sixteen analysis rules", () => {
    expect(KNOWN_RULE_IDS).toHaveLength(16);
  });

  it("never uses accusing words", () => {
    for (const id of KNOWN_RULE_IDS) {
      const c = ruleCopy(id, "CASE");
      expect(c.reason).not.toMatch(BANNED);
      expect(c.nextStep).not.toMatch(BANNED);
    }
  });

  it("says nothing is paused for a note and falls back for unknown rules", () => {
    expect(ruleCopy("EXP_ROUND_AMOUNT", "NOTE").nextStep).toMatch(/No action/);
    expect(ruleCopy("NOPE", "CASE").reason.length).toBeGreaterThan(10);
  });
});
