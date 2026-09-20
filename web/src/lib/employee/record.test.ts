import { describe, expect, it } from "vitest";
import type { FindingReviewStatus, FindingSeverity } from "@/contracts/employee";
import { FIXTURE_EMPLOYEE_IDS, fixtureCopy } from "@/fixtures/employee";
import { createFixtureEmployeeRepo } from "@/fixtures/employee/repo";
import { containsForbiddenWord } from "@/lib/employee/forbidden-words";
import {
  buildRecordFindings,
  buildScoreChanges,
  deltaLabel,
  reviewStatusLabel,
  severityLabel,
} from "@/lib/employee/record";

const REVIEW_STATUSES: FindingReviewStatus[] = ["PENDING_REVIEW", "NO_ACTION", "CONFIRMED"];
const SEVERITIES: FindingSeverity[] = ["IMMEDIATE_HOLD", "CASE", "NOTE"];

async function findingsFor(userId: string) {
  const repo = createFixtureEmployeeRepo();
  return buildRecordFindings(await repo.listFindings(userId));
}

describe("record findings", () => {
  it("gives every finding a reason, an amount, both dates and a status", async () => {
    const findings = await findingsFor(FIXTURE_EMPLOYEE_IDS.held);
    expect(findings.length).toBeGreaterThan(0);
    for (const finding of findings) {
      expect(finding.reason.length).toBeGreaterThan(0);
      expect(finding.nextStep.length).toBeGreaterThan(0);
      expect(finding.amountCents).toBeGreaterThan(0);
      expect(finding.incurredOn).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(finding.detectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(finding.statusLabel.length).toBeGreaterThan(0);
    }
  });

  it("lists findings newest first", async () => {
    const stamps = (await findingsFor(FIXTURE_EMPLOYEE_IDS.held)).map((f) => f.detectedAt);
    expect([...stamps].sort((a, b) => b.localeCompare(a))).toEqual(stamps);
  });

  it("shows the remote-work employee no finding", async () => {
    expect(await findingsFor(FIXTURE_EMPLOYEE_IDS.remote)).toEqual([]);
    expect(await findingsFor(FIXTURE_EMPLOYEE_IDS.clean)).toEqual([]);
  });

  it("shows a reviewed finding as reviewed, and hides it when the flag is off", async () => {
    const repo = createFixtureEmployeeRepo();
    const all = await repo.listFindings(FIXTURE_EMPLOYEE_IDS.held);
    const shown = buildRecordFindings(all, true);
    const hidden = buildRecordFindings(all, false);
    expect(shown.some((f) => f.statusLabel === "Reviewed, no action taken")).toBe(true);
    expect(hidden.some((f) => f.statusLabel === "Reviewed, no action taken")).toBe(false);
    expect(hidden.length).toBe(shown.length - 1);
  });

  it("links a finding to the submissions it is about", async () => {
    const findings = await findingsFor(FIXTURE_EMPLOYEE_IDS.held);
    const location = findings.find((f) => f.ruleId === "TS_LOCATION_CONFLICT");
    expect(location?.relatedHrefs).toEqual([
      { label: "The expense", href: "/employee/submissions/expense/exp_chicago_lunch" },
      { label: "The timesheet", href: "/employee/submissions/timesheet/ts_held_conflict" },
    ]);
  });
});

describe("score changes", () => {
  it("lists every change newest first with its reason", async () => {
    const repo = createFixtureEmployeeRepo();
    const score = await repo.getScore(FIXTURE_EMPLOYEE_IDS.held);
    const changes = buildScoreChanges(score?.events ?? []);
    expect(changes.length).toBe(score?.events.length);
    expect(changes.every((change) => change.reason.length > 0)).toBe(true);
    const stamps = changes.map((change) => change.createdAt);
    expect([...stamps].sort((a, b) => b.localeCompare(a))).toEqual(stamps);
  });

  it("reads a zero delta as no change", () => {
    expect(deltaLabel(0)).toBe("No change");
    expect(deltaLabel(12)).toBe("+12");
    expect(deltaLabel(-3)).toBe("-3");
  });
});

describe("user-facing copy", () => {
  it("contains no forbidden word, across fixture reasons and every label", () => {
    const copy = [
      ...fixtureCopy(),
      ...REVIEW_STATUSES.map(reviewStatusLabel),
      ...SEVERITIES.map(severityLabel),
    ];
    expect(copy.filter(containsForbiddenWord)).toEqual([]);
  });

  it("catches a forbidden word if one is ever introduced", () => {
    expect(containsForbiddenWord("This looks like fraud.")).toBe(true);
    expect(containsForbiddenWord("This receipt looks the same as an earlier one.")).toBe(false);
  });
});
