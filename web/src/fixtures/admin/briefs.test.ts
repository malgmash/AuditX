import { describe, expect, it } from "vitest";
import { CASES, EMPLOYEES } from "@/fixtures/admin/data";
import { fixtureAdminRepo } from "@/fixtures/admin/repo";

/**
 * The brief is what a reviewer reads before deciding about a colleague. These rules are not
 * style preferences: the wording constraint and the innocent explanations are what keep the
 * screen a judgement rather than a prosecution.
 */
const FORBIDDEN = ["fraud", "theft", "stealing", "dishonest", "guilty"];

const round2 = (n: number) => Math.round(n * 100) / 100;

describe("fixture briefs", () => {
  it("covers every demo scenario", () => {
    const ruleIds = CASES.flatMap((c) => c.findings.map((f) => f.ruleId));
    expect(ruleIds).toContain("DUP_RECEIPT_EXACT");
    expect(ruleIds).toContain("TS_LOCATION_CONFLICT");
    expect(ruleIds).toContain("EXP_ROUND_AMOUNT");
    expect(CASES.some((c) => c.findings.length > 1)).toBe(true);
    expect(CASES.some((c) => c.holds.length > 0)).toBe(true);
  });

  it("gives at least two innocent explanations in every brief", () => {
    for (const item of CASES) {
      expect(item.brief.innocentExplanations.length, item.id).toBeGreaterThanOrEqual(2);
      for (const explanation of item.brief.innocentExplanations) {
        expect(explanation.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("avoids the forbidden words in every brief", () => {
    for (const item of CASES) {
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
        expect(text, `${item.id} contains "${word}"`).not.toContain(word);
      }
    }
  });

  it("carries the whole brief in every case", () => {
    for (const item of CASES) {
      expect(item.brief.summary.length, item.id).toBeGreaterThan(0);
      expect(item.brief.whyFlagged.length, item.id).toBeGreaterThan(0);
      expect(item.brief.confidenceNote.length, item.id).toBeGreaterThan(0);
      expect(item.brief.reviewSteps.length, item.id).toBeGreaterThanOrEqual(3);
      expect(item.brief.questionsForEmployee.length, item.id).toBeGreaterThanOrEqual(2);
    }
  });

  it("exercises both the present and absent policy reference", () => {
    expect(CASES.some((c) => c.brief.policyReference === null)).toBe(true);
    expect(CASES.some((c) => c.brief.policyReference !== null)).toBe(true);
  });

  it("keeps every amount in integer cents", () => {
    for (const item of CASES) {
      expect(Number.isInteger(item.amountAtRiskCents), item.id).toBe(true);
      for (const f of item.findings) expect(Number.isInteger(f.amountAtRiskCents)).toBe(true);
      for (const h of item.holds) expect(Number.isInteger(h.amountCents)).toBe(true);
    }
  });
});

describe("scores", () => {
  it("records a penalty equal to the points its finding carries", () => {
    // The invariant reversal rests on: what a finding deducted is what a reversal gives back.
    // If these drift apart, releasing a hold silently leaves the score wrong.
    for (const item of CASES) {
      for (const finding of item.findings) {
        const employee = EMPLOYEES.find((e) => e.id === item.subject.id);
        const event = employee?.scoreEvents.find((s) => s.findingId === finding.id);
        expect(event, `no score event for ${finding.id}`).toBeDefined();
        expect(event?.delta, finding.id).toBe(-finding.penaltyPoints);
      }
    }
  });

  it("derives a score in range for every employee", async () => {
    for (const row of await fixtureAdminRepo.listEmployees()) {
      expect(row.score, row.name).toBeGreaterThanOrEqual(0);
      expect(row.score, row.name).toBeLessThanOrEqual(100);
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
    const before = (await fixtureAdminRepo.getEmployee("usr_venkatesan"))?.score ?? 0;
    const penalty = CASES.find((c) => c.id === "case_4462")?.findings[0]?.penaltyPoints ?? 0;

    // The restoration must not be clipped by the 0 to 100 clamp, which would let the test pass
    // while hiding a mismatch between the penalty and the amount given back.
    expect(before + penalty).toBeLessThanOrEqual(100);

    const result = await fixtureAdminRepo.reverseHold({
      holdId: "hold_pv_dell",
      note: null,
      actor: { id: "usr_admin", name: "K. Salama" },
    });

    expect(result.subjectScoreBefore).toBe(before);
    expect(result.subjectScoreAfter).toBe(round2(before + penalty));
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

  it("keeps a declined case's finding on the record", async () => {
    const person = await fixtureAdminRepo.getEmployee("usr_kowalski");
    // case_4459 was declined in the test above. The finding stays as a label, never deleted.
    expect(person?.findings.some((f) => f.ruleId === "EXP_ROUND_AMOUNT")).toBe(true);
    expect(person?.amountAtRiskCents).toBe(0);
  });

  it("rejects deciding the same case twice", async () => {
    await expect(
      fixtureAdminRepo.decideCase({
        caseId: "case_4459",
        decision: "ACCEPTED",
        note: null,
        actor: { id: "usr_admin", name: "K. Salama" },
      }),
    ).rejects.toThrow(/already been decided/);
  });
});
