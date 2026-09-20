import { describe, expect, it } from "vitest";
import { CASES } from "@/fixtures/admin/data";
import { fixtureAdminRepo } from "@/fixtures/admin/repo";

/**
 * The brief is what a reviewer reads before deciding about a colleague. These rules are not
 * style preferences: the wording constraint and the innocent explanations are what keep the
 * screen a judgement rather than a prosecution.
 */
const FORBIDDEN = ["fraud", "theft", "stealing", "dishonest", "guilty"];

describe("fixture briefs", () => {
  it("covers every demo scenario", () => {
    const ruleIds = CASES.flatMap((c) => c.findings.map((f) => f.ruleId));
    expect(ruleIds).toContain("DUP_RECEIPT_EXACT");
    expect(ruleIds).toContain("TS_LOCATION_CONFLICT");
    expect(ruleIds).toContain("EXP_ROUND_AMOUNT");
    expect(CASES.some((c) => c.findings.length > 1)).toBe(true);
    expect(CASES.some((c) => c.holds.length > 0)).toBe(true);
  });

  it.each(CASES.map((c) => [c.id, c] as const))(
    "%s gives at least two innocent explanations",
    (_id, item) => {
      expect(item.brief.innocentExplanations.length).toBeGreaterThanOrEqual(2);
      for (const explanation of item.brief.innocentExplanations) {
        expect(explanation.trim().length).toBeGreaterThan(0);
      }
    },
  );

  it.each(CASES.map((c) => [c.id, c] as const))("%s avoids the forbidden words", (_id, item) => {
    const text = [
      item.brief.summary,
      item.brief.whyFlagged,
      item.brief.confidenceNote,
      item.brief.policyReference ?? "",
      ...item.brief.reviewSteps,
      ...item.brief.questionsForEmployee,
      ...item.brief.innocentExplanations,
    ]
      .join(" ")
      .toLowerCase();

    for (const word of FORBIDDEN) {
      expect(text).not.toContain(word);
    }
  });

  it.each(CASES.map((c) => [c.id, c] as const))("%s carries the whole brief", (_id, item) => {
    expect(item.brief.summary.length).toBeGreaterThan(0);
    expect(item.brief.whyFlagged.length).toBeGreaterThan(0);
    expect(item.brief.confidenceNote.length).toBeGreaterThan(0);
    expect(item.brief.reviewSteps.length).toBeGreaterThanOrEqual(3);
    expect(item.brief.questionsForEmployee.length).toBeGreaterThanOrEqual(2);
  });

  it("includes a case with no policy reference, so the absent state is exercised", () => {
    expect(CASES.some((c) => c.brief.policyReference === null)).toBe(true);
    expect(CASES.some((c) => c.brief.policyReference !== null)).toBe(true);
  });
});

describe("money", () => {
  it("keeps every amount in integer cents", () => {
    for (const item of CASES) {
      expect(Number.isInteger(item.amountAtRiskCents)).toBe(true);
      for (const f of item.findings) expect(Number.isInteger(f.amountAtRiskCents)).toBe(true);
      for (const h of item.holds) expect(Number.isInteger(h.amountCents)).toBe(true);
    }
  });
});

describe("scores", () => {
  it("derives a score in range for every employee", async () => {
    for (const row of await fixtureAdminRepo.listEmployees()) {
      expect(row.score).toBeGreaterThanOrEqual(0);
      expect(row.score).toBeLessThanOrEqual(100);
    }
  });

  it("sorts by amount at risk descending by default", async () => {
    const rows = await fixtureAdminRepo.listEmployees();
    const amounts = rows.map((r) => r.amountAtRiskCents);
    expect([...amounts].sort((a, b) => b - a)).toEqual(amounts);
  });

  it("sorts ascending when asked", async () => {
    const rows = await fixtureAdminRepo.listEmployees("score", "asc");
    const scores = rows.map((r) => r.score);
    expect([...scores].sort((a, b) => a - b)).toEqual(scores);
  });

  it("restores the exact prior score when a hold is released", async () => {
    const subject = "usr_venkatesan";
    const before = (await fixtureAdminRepo.getEmployee(subject))?.score ?? 0;

    const result = await fixtureAdminRepo.reverseHold({
      holdId: "hold_pv_dell",
      note: null,
      actor: { id: "usr_admin", name: "K. Salama" },
    });

    expect(result.subjectScoreBefore).toBe(before);
    // The finding cost 29.7 points, so releasing returns the score to exactly 100.
    expect(result.subjectScoreAfter).toBe(100);
  });

  it("rejects releasing the same hold twice", async () => {
    await expect(
      fixtureAdminRepo.reverseHold({
        holdId: "hold_pv_dell",
        note: null,
        actor: { id: "usr_admin", name: "K. Salama" },
      }),
    ).rejects.toThrow(/already been released/);
  });

  it("writes an audit row for every decision", async () => {
    const before = (await fixtureAdminRepo.listAudit(50)).length;
    await fixtureAdminRepo.decideCase({
      caseId: "case_4459",
      decision: "DECLINED",
      note: "Fare confirmed against the receipt",
      actor: { id: "usr_admin", name: "K. Salama" },
    });
    const after = await fixtureAdminRepo.listAudit(50);
    expect(after.length).toBe(before + 1);
    expect(after[0].action).toBe("CASE_DECIDED");
  });
});
