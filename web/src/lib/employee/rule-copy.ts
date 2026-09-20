import type { FindingSeverity } from "@/contracts/employee";

/**
 * Plain-language wording for a finding, written for the person it is about. Rule ids and
 * meanings mirror analysis/app/detect/rules.py. The wording never blames: it says what the
 * system noticed and what happens next.
 */
export type RuleCopy = { reason: string; nextStep: string };

const REVIEW_NEXT = "A reviewer will look at it, then either leave it as it is or ask you a question.";
const NOTE_NEXT = "No action is needed unless a reviewer asks about it.";

const COPY: Record<string, RuleCopy> = {
  DUP_RECEIPT_EXACT: {
    reason: "The same receipt file was submitted more than once.",
    nextStep: "A reviewer will compare the two submissions. You can add a note if they ask.",
  },
  DUP_RECEIPT_IMAGE: {
    reason: "A photo of this receipt looks the same as an earlier receipt.",
    nextStep: "A reviewer will compare the two receipts. You can add a note if they ask.",
  },
  DUP_RECEIPT_FIELDS: {
    reason: "Two claims name the same merchant, on the same or the next day, for almost the same amount.",
    nextStep: "A reviewer will compare the two claims. If both are real, you can tell them so.",
  },
  DUP_RECEIPT_CROSS_USER: {
    reason: "This receipt looks the same as one that was submitted under another account.",
    nextStep: "A reviewer will compare the two receipts. If you shared the purchase, you can tell them so.",
  },
  EXP_AMOUNT_OUTLIER_SELF: {
    reason: "This amount is well above what you usually claim in this category.",
    nextStep: REVIEW_NEXT,
  },
  EXP_AMOUNT_OUTLIER_PEER: {
    reason: "This amount is well above what colleagues in your department usually claim in this category.",
    nextStep: REVIEW_NEXT,
  },
  EXP_VELOCITY: {
    reason: "Several claims were submitted in a short period, more than you usually submit.",
    nextStep: REVIEW_NEXT,
  },
  EXP_CATEGORY_MISMATCH: {
    reason: "The category on this claim does not match what this merchant normally sells.",
    nextStep: "You can correct the category on the claim, or a reviewer may ask about it.",
  },
  EXP_ROUND_AMOUNT: {
    reason: "This claim is for an exactly round amount.",
    nextStep: NOTE_NEXT,
  },
  EXP_OFF_PATTERN: {
    reason: "This claim was made on a weekend or holiday, which is not usual for you in this category.",
    nextStep: NOTE_NEXT,
  },
  TS_LOCATION_CONFLICT: {
    reason: "Your timesheet places you at one location while a receipt that day is from another city.",
    nextStep: "You can correct the location on the timesheet, or reply when a reviewer asks.",
  },
  TS_OVERLAP: {
    reason: "Two entries on your timesheet cover the same time.",
    nextStep: "You can correct the entries, or reply when a reviewer asks.",
  },
  TS_IMPOSSIBLE_HOURS: {
    reason: "More hours were logged than a day or a week can reasonably hold.",
    nextStep: "You can correct the hours on the timesheet, or reply when a reviewer asks.",
  },
  TS_COPY_PASTE: {
    reason: "This week is identical, to the minute, to at least two earlier weeks.",
    nextStep: "If the weeks really were the same, no action is needed. A reviewer may ask.",
  },
  TS_ROUND_HOURS: {
    reason: "Every entry has been exactly eight hours for several weeks in a row.",
    nextStep: NOTE_NEXT,
  },
  TS_HOLIDAY: {
    reason: "Hours were logged on a company holiday with no approval noted.",
    nextStep: "You can add the approval to the timesheet, or reply when a reviewer asks.",
  },
};

export function ruleCopy(ruleId: string, severity: FindingSeverity): RuleCopy {
  const known = COPY[ruleId];
  if (known) {
    return severity === "NOTE" ? { ...known, nextStep: NOTE_NEXT } : known;
  }
  return {
    reason: "Something on this record was flagged for a closer look.",
    nextStep: severity === "NOTE" ? NOTE_NEXT : REVIEW_NEXT,
  };
}

export const KNOWN_RULE_IDS = Object.keys(COPY);
