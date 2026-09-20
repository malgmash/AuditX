import { describe, expect, it } from "vitest";
import { buildBrief, evidenceRows } from "@/lib/admin/brief";
import { weekStartOf } from "@/lib/admin/db-repo";

const RULES = [
  "DUP_RECEIPT_EXACT",
  "DUP_RECEIPT_IMAGE",
  "DUP_RECEIPT_FIELDS",
  "DUP_RECEIPT_CROSS_USER",
  "EXP_AMOUNT_OUTLIER_SELF",
  "EXP_AMOUNT_OUTLIER_PEER",
  "EXP_VELOCITY",
  "EXP_CATEGORY_MISMATCH",
  "EXP_ROUND_AMOUNT",
  "EXP_OFF_PATTERN",
  "TS_LOCATION_CONFLICT",
  "TS_OVERLAP",
  "TS_IMPOSSIBLE_HOURS",
  "TS_COPY_PASTE",
  "TS_ROUND_HOURS",
  "TS_HOLIDAY",
];

const FORBIDDEN = /\b(fraud\w*|theft|steal\w*|dishonest\w*|guilty)\b/i;
const ctx = { subjectName: "Jamie Okafor", merchant: "Union Hall Coffee", amountCents: 12800, occurredOn: "2026-03-02T00:00:00Z" };

describe("buildBrief", () => {
  it.each(RULES)("%s gives a complete, neutral brief", (ruleId) => {
    const brief = buildBrief([{ ruleId, confidence: 0.8, evidence: { amount_cents_this: 12800, days_apart: 1 } }], ctx);
    expect(brief.summary.length).toBeGreaterThan(20);
    expect(brief.whyFlagged.length).toBeGreaterThan(20);
    expect(brief.reviewSteps.length).toBeGreaterThanOrEqual(3);
    expect(brief.questionsForEmployee.length).toBeGreaterThanOrEqual(2);
    expect(brief.innocentExplanations.length).toBeGreaterThanOrEqual(2);
    expect(brief.confidenceNote).toMatch(/0\.80/);
    expect(brief.policyReference).toBeNull();
    const text = JSON.stringify(brief);
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toMatch(/undefined|NaN|\[object/);
  });

  it("falls back for an unknown rule and for a case with no findings", () => {
    expect(buildBrief([{ ruleId: "NEW_RULE", confidence: 0.5, evidence: {} }], ctx).innocentExplanations.length).toBeGreaterThanOrEqual(2);
    expect(buildBrief([], ctx).innocentExplanations.length).toBeGreaterThanOrEqual(2);
  });

  it("says how many more findings a case holds", () => {
    const brief = buildBrief(
      [
        { ruleId: "EXP_ROUND_AMOUNT", confidence: 0.45, evidence: {} },
        { ruleId: "EXP_VELOCITY", confidence: 0.6, evidence: {} },
      ],
      ctx,
    );
    expect(brief.summary).toMatch(/1 more finding is on this case/);
  });

  it("uses the evidence in the summary", () => {
    const brief = buildBrief([{ ruleId: "TS_OVERLAP", confidence: 0.95, evidence: { work_date: "2026-05-01", overlap_hours: 2 } }], ctx);
    expect(brief.summary).toMatch(/May 1, 2026/);
    expect(brief.summary).toMatch(/2 hours/);
  });
});

describe("evidenceRows", () => {
  it("labels keys, formats cents as dollars and booleans as yes or no", () => {
    const rows = evidenceRows({ amount_cents_this: 16345, same_user: false, receipt_cities: ["chicago"], hamming_distance: 18 });
    expect(rows).toContainEqual({ label: "Amount this", value: "$163.45" });
    expect(rows).toContainEqual({ label: "Same person", value: "No" });
    expect(rows).toContainEqual({ label: "Receipt cities", value: "chicago" });
    expect(rows).toContainEqual({ label: "Image difference (bits)", value: "18" });
  });

  it("returns nothing for missing evidence", () => {
    expect(evidenceRows(null)).toEqual([]);
    expect(evidenceRows([1, 2])).toEqual([]);
  });
});

describe("weekStartOf", () => {
  it("returns the Monday of the week in UTC", () => {
    expect(weekStartOf(new Date("2026-09-20T12:00:00Z"))).toBe("2026-09-14"); // a Sunday
    expect(weekStartOf(new Date("2026-09-14T00:00:00Z"))).toBe("2026-09-14"); // a Monday
    expect(weekStartOf(new Date("2026-09-17T23:59:59Z"))).toBe("2026-09-14");
  });
});
