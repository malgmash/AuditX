import type { CaseBrief, EvidenceRow } from "@/contracts/admin";

/**
 * Real cases have no written brief, because the investigator is out of scope. This builds one
 * from the rule that fired and the evidence it recorded. Every brief holds at least two innocent
 * explanations, three review steps and two neutral questions, and never says whether anyone did
 * something wrong: the reviewer decides that.
 */

export type BriefContext = {
  subjectName: string;
  /** The claim the finding is about, when it names one. */
  merchant: string | null;
  amountCents: number;
  /** ISO date of the claim or the timesheet day. */
  occurredOn: string | null;
};

const usdFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usd = (cents: number) => usdFmt.format(cents / 100);
const dayFmt = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const day = (iso: string | null) => (iso ? dayFmt.format(new Date(iso)) : "the date in question");

function num(evidence: Record<string, unknown>, key: string): number | null {
  const v = evidence[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

const NOT_A_VERDICT =
  "This is a pattern match. It says something on the record is unusual, not what the reason is.";

type Parts = Pick<CaseBrief, "summary" | "whyFlagged" | "reviewSteps" | "questionsForEmployee" | "innocentExplanations">;

function forRule(f: RawEvidenceFinding, c: BriefContext): Parts {
  const e = f.evidence;
  const where = c.merchant ? `at ${c.merchant}` : "on this record";
  switch (f.ruleId) {
    case "DUP_RECEIPT_EXACT":
      return {
        summary: `The same receipt file was submitted twice ${where}, for ${usd(num(e, "amount_cents_this") ?? c.amountCents)}. The two uploads are identical byte for byte.`,
        whyFlagged:
          "A receipt file has a fingerprint. Two files with the same fingerprint are the same file. This is the most precise check the system has, but it says nothing about why it happened.",
        reviewSteps: [
          "Open both claims and confirm they point at the same purchase.",
          "Check which claim was submitted first and whether either was already reimbursed.",
          "Look at the submission times to see whether the second upload was a quick retry.",
        ],
        questionsForEmployee: [
          "Did you mean to submit this receipt once or twice?",
          "Was the first submission showing an error when you tried again?",
        ],
        innocentExplanations: [
          "The upload page showed an error and the receipt was sent again.",
          "A claim was resubmitted after a correction, and the original was never withdrawn.",
        ],
      };
    case "DUP_RECEIPT_IMAGE":
    case "DUP_RECEIPT_CROSS_USER": {
      const cross = f.ruleId === "DUP_RECEIPT_CROSS_USER";
      return {
        summary: cross
          ? `A receipt ${where} for ${usd(num(e, "amount_cents_this") ?? c.amountCents)} looks the same as one submitted under another account, ${num(e, "days_apart") ?? 0} days apart.`
          : `A photo of a receipt ${where} for ${usd(num(e, "amount_cents_this") ?? c.amountCents)} looks the same as an earlier receipt submitted ${num(e, "days_apart") ?? 0} days before.`,
        whyFlagged:
          "The system compares the shape of each receipt image with earlier receipts. Two images can look alike because one was photographed again, or because receipts from the same merchant share a layout. The check ignores receipts that look like many others.",
        reviewSteps: [
          "Open both receipts side by side and compare the printed time and total.",
          cross ? "Check whether the two people were at the same event or meal." : "Check whether the two claims describe the same purchase or two separate ones.",
          "Look at the amounts. A copied receipt with a changed total is worth a closer look.",
        ],
        questionsForEmployee: [
          "Can you tell us about this receipt and when the purchase was made?",
          cross ? "Did you share this purchase with a colleague?" : "Is this the same purchase as your earlier claim, or a different one?",
        ],
        innocentExplanations: cross
          ? [
              "Two colleagues at the same meal each submitted their own share.",
              "One person photographed the receipt and shared it with a colleague who submitted it as well.",
            ]
          : [
              "The receipt was photographed twice and both photos were uploaded.",
              "Two purchases at the same merchant produced receipts with the same layout.",
            ],
      };
    }
    case "DUP_RECEIPT_FIELDS":
      return {
        summary: `Two claims ${where} are for almost the same amount (${usd(num(e, "amount_cents_prior") ?? 0)} and ${usd(num(e, "amount_cents_this") ?? c.amountCents)}) on the same or the next day.`,
        whyFlagged:
          "The merchant, the date and the amount all match closely. Recurring charges with a regular schedule are excluded. This rule is less precise than a matching file, because two real purchases can look alike.",
        reviewSteps: [
          "Open both claims and compare the receipt times when they are printed.",
          "Check whether the merchant normally sells this amount, such as a fare or a daily charge.",
          "Look at the person's earlier claims for a similar pair.",
        ],
        questionsForEmployee: [
          "Were these two separate purchases?",
          "Can you tell us what each of the two claims covers?",
        ],
        innocentExplanations: [
          "Two real purchases at the same place cost nearly the same, such as two fares or two lunches.",
          "A claim was resubmitted with a small correction to the amount.",
        ],
      };
    case "EXP_AMOUNT_OUTLIER_SELF":
      return {
        summary: `A claim ${where} for ${usd(c.amountCents)} is well above this person's usual ${usd(num(e, "median_cents") ?? 0)} in the same category.`,
        whyFlagged:
          "The amount is compared with this person's own history in the category, using the median and the spread of their earlier claims. It says the amount is unusual for them, not that it is wrong.",
        reviewSteps: [
          "Open the receipt and check whether it covers more than one person.",
          "Check whether a trip or event on that date explains the larger amount.",
          "Compare with the person's other claims in the category.",
        ],
        questionsForEmployee: [
          "What did this claim cover?",
          "Was there a trip, event or group purchase behind the larger amount?",
        ],
        innocentExplanations: [
          "The claim covered a group or a client rather than one person.",
          "A one-off purchase, such as a conference or a repair, sits outside the usual pattern.",
        ],
      };
    case "EXP_AMOUNT_OUTLIER_PEER":
      return {
        summary: `A claim ${where} for ${usd(c.amountCents)} is well above what colleagues in the same department usually claim (${usd(num(e, "department_median_cents") ?? 0)}).`,
        whyFlagged:
          "The amount is compared with claims from the same department in the same category. Roles differ, so a higher figure can be normal for one person.",
        reviewSteps: [
          "Open the receipt and check what was bought.",
          "Consider whether this person's role or travel schedule explains a higher figure.",
          "Compare with their own earlier claims, not only their colleagues'.",
        ],
        questionsForEmployee: [
          "Can you tell us what this claim was for?",
          "Is this a usual expense for your role?",
        ],
        innocentExplanations: [
          "This person's role involves more client entertainment than the department average.",
          "The claim covered several people.",
        ],
      };
    case "EXP_VELOCITY":
      return {
        summary: `${num(e, "claims_in_window") ?? "Many"} claims were submitted in seven days, against a usual pace of about ${num(e, "weekly_median") ?? "a few"} a week.`,
        whyFlagged:
          "The number of claims in a rolling week is compared with this person's own weekly pattern. A burst can follow a trip or a delayed batch of submissions.",
        reviewSteps: [
          "List the claims in the window and check whether they share a trip or event.",
          "Look at the submission times to see whether they were entered together.",
          "Check whether an earlier quiet period explains a catch-up.",
        ],
        questionsForEmployee: [
          "Were these claims part of one trip or event?",
          "Were some of them held back and submitted together?",
        ],
        innocentExplanations: [
          "A business trip produced many small receipts, all submitted on return.",
          "Claims from earlier weeks were entered late.",
        ],
      };
    case "EXP_CATEGORY_MISMATCH":
      return {
        summary: `A claim ${where} for ${usd(c.amountCents)} was filed under ${String(e["claimed_category"] ?? "one category")}, but this merchant usually sells ${String(e["merchant_usual_category"] ?? "something else")}.`,
        whyFlagged:
          "The category chosen on the claim differs from what the merchant normally sells. Merchants sell more than one thing, so this is often a filing choice.",
        reviewSteps: [
          "Open the receipt and read the line items.",
          "Check whether the category on the claim fits what was bought.",
          "Consider recategorising the claim before a decision.",
        ],
        questionsForEmployee: [
          "What did you buy here?",
          "Was the category picked because of the purchase, or because it was closest?",
        ],
        innocentExplanations: [
          "The merchant sells several kinds of goods and the category fits this purchase.",
          "The category list did not have a closer match.",
        ],
      };
    case "EXP_ROUND_AMOUNT":
      return {
        summary: `A claim ${where} is for exactly ${usd(c.amountCents)}.`,
        whyFlagged:
          "Real receipts rarely land on a whole multiple of fifty dollars. This is a weak signal on its own, which is why it is usually recorded as a note.",
        reviewSteps: [
          "Open the receipt and check the printed total.",
          "Check whether the merchant charges fixed prices, such as a booking fee or a deposit.",
          "Look at whether other flags sit on the same claim.",
        ],
        questionsForEmployee: [
          "Can you confirm the total on the receipt?",
          "Is this a fixed-price charge?",
        ],
        innocentExplanations: [
          "The merchant charges a fixed price, such as a registration or a deposit.",
          "A prepaid card or a voucher was for a round amount.",
        ],
      };
    case "EXP_OFF_PATTERN":
      return {
        summary: `A claim ${where} for ${usd(c.amountCents)} was made on a weekend or holiday. This person has ${num(e, "prior_off_day_claims") ?? 0} earlier claims on such days in this category.`,
        whyFlagged:
          "The day of the week is compared with this person's earlier claims in the category. A first weekend claim is unusual for them, not necessarily wrong.",
        reviewSteps: [
          "Open the receipt and check the date and time printed on it.",
          "Check whether the person was travelling or on call that day.",
          "Look at the timesheet for that week.",
        ],
        questionsForEmployee: [
          "What was this purchase for?",
          "Were you working or travelling that day?",
        ],
        innocentExplanations: [
          "The person was travelling or on call over the weekend.",
          "The claim was submitted on a weekend for a purchase made earlier.",
        ],
      };
    case "TS_LOCATION_CONFLICT":
      return {
        summary: `On ${day(String(e["work_date"] ?? c.occurredOn))}, ${num(e, "hours") ?? "several"} hours were logged at ${String(e["declared_location"] ?? "one location")} while a receipt places the person in ${String((e["receipt_cities"] as unknown[] | undefined)?.[0] ?? "another city")} during those hours.`,
        whyFlagged:
          "The location written on a timesheet entry is compared with the city of any expense made during those hours. When they name two cities at once, one of the two records is probably wrong. It does not say which one, or why.",
        reviewSteps: [
          "Open the receipt and confirm the merchant address is in the other city, not a head office.",
          "Check the timesheet note for a travel day or a client site.",
          "Look at the days on either side to see whether a trip was underway.",
        ],
        questionsForEmployee: [
          `Can you confirm where you worked on ${day(String(e["work_date"] ?? c.occurredOn))}?`,
          "Was the receipt part of a trip or a client visit?",
          "Is the location on that day's timesheet the one you intended?",
        ],
        innocentExplanations: [
          "A remote day or a trip was entered on the timesheet with the office as its location.",
          "A colleague's receipt was submitted in this person's name.",
        ],
      };
    case "TS_OVERLAP":
      return {
        summary: `Two timesheet entries on ${day(String(e["work_date"] ?? c.occurredOn))} overlap by ${num(e, "overlap_hours") ?? "some"} hours.`,
        whyFlagged: "Two entries by one person cover the same time. That is usually a data-entry slip.",
        reviewSteps: [
          "Open the day and compare the start and end times of both entries.",
          "Check whether two projects were logged for the same hours by mistake.",
          "Check the note fields for an explanation.",
        ],
        questionsForEmployee: [
          "Can you confirm the hours you worked that day?",
          "Were both entries meant to cover the same time?",
        ],
        innocentExplanations: [
          "One entry was edited and the old version was left in.",
          "Time was split across two projects and the times were typed in twice.",
        ],
      };
    case "TS_IMPOSSIBLE_HOURS":
      return {
        summary: `${num(e, "hours") ?? "More than a possible number of"} hours were logged on ${day(String(e["date"] ?? c.occurredOn))}, above the limit of ${num(e, "limit_hours") ?? 16} for a ${String(e["scope"] ?? "day")}.`,
        whyFlagged: "More hours were logged than a day or a week can reasonably hold. A typing slip is the most common cause.",
        reviewSteps: [
          "Open the day and check each entry's start and end time.",
          "Look for a duplicated entry or a mistyped hour.",
          "Check whether an overnight shift or a travel day explains it.",
        ],
        questionsForEmployee: [
          "Can you confirm the hours worked on that day?",
          "Was there an overnight shift or travel involved?",
        ],
        innocentExplanations: [
          "A typing slip, such as 19 instead of 9.",
          "An overnight shift that crossed midnight was entered on one day.",
        ],
      };
    case "TS_COPY_PASTE":
      return {
        summary: `${num(e, "identical_weeks") ?? "Several"} weeks in a row have identical entries, to the minute, at ${num(e, "hours_per_week") ?? "the same"} hours a week.`,
        whyFlagged:
          "Real weeks vary by a few minutes. Identical weeks can mean a template was copied, which is common when the work itself is regular.",
        reviewSteps: [
          "Open the weeks side by side and compare start and end times.",
          "Check whether the work is on a fixed schedule, such as shift work.",
          "Ask whether a timesheet template is in use.",
        ],
        questionsForEmployee: [
          "Are your hours set by a fixed schedule?",
          "Do you copy the previous week when you fill in your timesheet?",
        ],
        innocentExplanations: [
          "A fixed shift pattern produces identical weeks.",
          "A copy-forward feature was used and the times happened to be right.",
        ],
      };
    case "TS_ROUND_HOURS":
      return {
        summary: `Every entry has been exactly eight hours for ${num(e, "consecutive_weeks") ?? "several"} weeks in a row.`,
        whyFlagged: "Entries of exactly eight hours for weeks on end are common with a standard day, so this is recorded as a note.",
        reviewSteps: [
          "Check whether the person works a fixed eight-hour day.",
          "Look at the start and end times, if they are entered.",
          "Compare with peers on the same schedule.",
        ],
        questionsForEmployee: [
          "Is your working day a fixed eight hours?",
          "Do you record actual start and end times?",
        ],
        innocentExplanations: [
          "The person works a standard eight-hour day and records it as such.",
          "The team's convention is to enter the scheduled hours.",
        ],
      };
    case "TS_HOLIDAY":
      return {
        summary: `${num(e, "hours") ?? "Some"} hours were logged on ${day(String(e["work_date"] ?? c.occurredOn))}, a company holiday, with no approval noted.`,
        whyFlagged: "Hours on a company holiday usually need an approval note. The note may exist elsewhere.",
        reviewSteps: [
          "Check whether the person was on call or approved to work that day.",
          "Look at the note field on the entry.",
          "Ask the person's manager, if the person agrees.",
        ],
        questionsForEmployee: [
          "Were you asked to work on that day?",
          "Is there an approval that was not recorded?",
        ],
        innocentExplanations: [
          "The person was on call or asked to cover, and the approval was given verbally.",
          "The entry was created for the wrong date.",
        ],
      };
    default:
      return {
        summary: `A rule flagged ${usd(c.amountCents)} for review ${where}.`,
        whyFlagged: "A rule found something on this record that differs from the usual pattern.",
        reviewSteps: [
          "Open the linked documents and read them.",
          "Compare with this person's earlier records.",
          "Check the raw evidence for the rule that fired.",
        ],
        questionsForEmployee: ["Can you tell us about this item?", "Is there context that the record does not show?"],
        innocentExplanations: ["An ordinary one-off explains the difference.", "A data-entry slip explains the difference."],
      };
  }
}

type RawEvidenceFinding = { ruleId: string; confidence: number; evidence: Record<string, unknown> };

function confidenceNote(confidence: number): string {
  const level = confidence >= 0.85 ? "high" : confidence >= 0.6 ? "moderate" : "low";
  return `The rule's confidence is ${confidence.toFixed(2)}, which is ${level}. ${NOT_A_VERDICT}`;
}

/** Build a brief for a case from its findings. The first finding leads. */
export function buildBrief(findings: RawEvidenceFinding[], context: BriefContext): CaseBrief {
  const [first, ...rest] = findings;
  if (!first) {
    return {
      summary: "This case has no findings attached.",
      whyFlagged: "Nothing was recorded.",
      reviewSteps: ["Open the linked documents.", "Compare with earlier records.", "Decide whether it needs a next step."],
      questionsForEmployee: ["Can you tell us about this item?", "Is there context the record does not show?"],
      innocentExplanations: ["A record was linked in error.", "The finding was removed after review."],
      confidenceNote: NOT_A_VERDICT,
      policyReference: null,
    };
  }
  const parts = forRule(first, context);
  return {
    ...parts,
    summary: rest.length ? `${parts.summary} ${rest.length} more ${rest.length === 1 ? "finding is" : "findings are"} on this case.` : parts.summary,
    confidenceNote: confidenceNote(first.confidence),
    policyReference: null,
  };
}

const LABELS: Record<string, string> = {
  same_user: "Same person",
  days_apart: "Days apart",
  matched_layer: "Matched by",
  prior_user_id: "Other person",
  hamming_distance: "Image difference (bits)",
  prior_expense_id: "Earlier claim",
  prior_submitted_at: "Earlier claim submitted",
  robust_z: "Robust z-score",
  sample_size: "Claims compared",
  z_threshold: "Threshold",
  claimed_category: "Category claimed",
  merchant_usual_category: "Merchant usually sells",
  declared_location: "Location on timesheet",
  declared_city: "City on timesheet",
  receipt_cities: "Receipt cities",
  receipt_times: "Receipt times",
};

function humanize(key: string): string {
  if (LABELS[key]) return LABELS[key]!;
  const words = key.replace(/_cents$/, "").replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function show(key: string, value: unknown): string {
  if (typeof value === "number" && key.endsWith("_cents")) return usd(value);
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === "number" && key.endsWith("_cents") ? usd(v) : String(v))).join(", ");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined) return "None";
  return String(value);
}

/** The raw evidence a detector stored, as label and value rows in a stable order. */
export function evidenceRows(evidence: unknown): EvidenceRow[] {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return [];
  return Object.entries(evidence as Record<string, unknown>).map(([key, value]) => ({
    label: humanize(key),
    value: show(key, value),
  }));
}

