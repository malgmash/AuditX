// Fixture data for the administrator screens. Everything the demo needs runs from here, so the
// product works with the network unplugged.
//
// Two rules this file must keep:
//   - Scores are derived from scoreEvents, never stored. A reversal is a new positive event, so
//     releasing a hold returns the score to exactly its prior value.
//   - Every brief carries at least two innocent explanations and none of the forbidden words.

import type {
  AdminCase,
  AuditEntry,
  DocumentRow,
  ScoreEvent,
  TimelineEvent,
} from "@/contracts/admin";

export type FixtureEmployee = {
  id: string;
  name: string;
  department: string;
  jobTitle: string;
  scoreEvents: ScoreEvent[];
  timeline: TimelineEvent[];
};

const ev = (
  id: string,
  createdAt: string,
  delta: number,
  reason: string,
  findingId: string | null = null,
): ScoreEvent => ({ id, findingId, delta, reason, createdAt });

export const EMPLOYEES: FixtureEmployee[] = [
  {
    id: "usr_reyes",
    name: "Marcus Reyes",
    department: "Sales",
    jobTitle: "Account Executive",
    scoreEvents: [
      ev("se_reyes_1", "2026-07-14T00:00:00Z", -9, "Claim above own range", "fnd_reyes_outlier"),
      ev("se_reyes_2", "2026-08-18T00:00:00Z", -16, "Claims above own range", "fnd_reyes_outlier"),
      ev("se_reyes_3", "2026-09-11T00:00:00Z", -14, "Several claims in a short period", "fnd_reyes_velocity"),
    ],
    timeline: [
      { id: "tl_reyes_1", at: "2026-07-14T00:00:00Z", kind: "FINDING", label: "Claim above own range", severity: "NOTE" },
      { id: "tl_reyes_2", at: "2026-08-18T00:00:00Z", kind: "FINDING", label: "Claims above own range", severity: "CASE" },
      { id: "tl_reyes_3", at: "2026-09-07T00:00:00Z", kind: "EXPENSE", label: "Airfare, Austin", severity: null },
      { id: "tl_reyes_4", at: "2026-09-09T00:00:00Z", kind: "EXPENSE", label: "Client dinner, Austin", severity: null },
      { id: "tl_reyes_5", at: "2026-09-11T00:00:00Z", kind: "FINDING", label: "Several claims in a short period", severity: "CASE" },
    ],
  },
  {
    id: "usr_okonkwo",
    name: "Daniel Okonkwo",
    department: "Field Operations",
    jobTitle: "Site Supervisor",
    scoreEvents: [
      ev("se_okonkwo_1", "2026-08-03T00:00:00Z", -4, "Round-amount claim", "fnd_okonkwo_round"),
      ev("se_okonkwo_2", "2026-09-08T00:00:00Z", -22, "Location conflict", "fnd_okonkwo_location"),
    ],
    timeline: [
      { id: "tl_ok_1", at: "2026-08-03T00:00:00Z", kind: "FINDING", label: "Round-amount claim", severity: "NOTE" },
      { id: "tl_ok_2", at: "2026-09-04T00:00:00Z", kind: "EXPENSE", label: "Hyatt Regency, Pittsburgh", severity: null },
      { id: "tl_ok_3", at: "2026-09-07T00:00:00Z", kind: "TIMESHEET", label: "Week of 07 Sep, Pittsburgh", severity: null },
      { id: "tl_ok_4", at: "2026-09-08T00:00:00Z", kind: "EXPENSE", label: "Lunch, Chicago", severity: null },
      { id: "tl_ok_5", at: "2026-09-08T00:00:00Z", kind: "FINDING", label: "Location conflict", severity: "CASE" },
      { id: "tl_ok_6", at: "2026-09-08T00:00:00Z", kind: "HOLD", label: "Hold placed on the Chicago lunch", severity: null },
    ],
  },
  {
    id: "usr_venkatesan",
    name: "Priya Venkatesan",
    department: "Engineering",
    jobTitle: "Staff Engineer",
    scoreEvents: [
      ev("se_priya_1", "2026-09-06T00:00:00Z", -22, "Same receipt submitted twice", "fnd_priya_dup"),
    ],
    timeline: [
      { id: "tl_pv_1", at: "2026-08-26T00:00:00Z", kind: "EXPENSE", label: "Dell Technologies", severity: null },
      { id: "tl_pv_2", at: "2026-09-06T00:00:00Z", kind: "EXPENSE", label: "Dell Technologies", severity: null },
      { id: "tl_pv_3", at: "2026-09-06T00:00:00Z", kind: "FINDING", label: "Same receipt submitted twice", severity: "IMMEDIATE_HOLD" },
      { id: "tl_pv_4", at: "2026-09-06T00:00:00Z", kind: "HOLD", label: "Reimbursement paused", severity: null },
    ],
  },
  {
    id: "usr_kowalski",
    name: "Hannah Kowalski",
    department: "Marketing",
    jobTitle: "Campaign Manager",
    scoreEvents: [
      ev("se_hk_1", "2026-09-03T00:00:00Z", -17, "Round-amount claim at the approval threshold", "fnd_hk_round"),
    ],
    timeline: [
      { id: "tl_hk_1", at: "2026-08-28T00:00:00Z", kind: "EXPENSE", label: "Marriott, Denver", severity: null },
      { id: "tl_hk_2", at: "2026-09-03T00:00:00Z", kind: "EXPENSE", label: "United Airlines", severity: null },
      { id: "tl_hk_3", at: "2026-09-03T00:00:00Z", kind: "FINDING", label: "Round-amount claim", severity: "CASE" },
    ],
  },
  {
    id: "usr_alvarez",
    name: "Tomas Alvarez",
    department: "Field Operations",
    jobTitle: "Field Technician",
    scoreEvents: [
      ev("se_ta_1", "2026-08-22T00:00:00Z", -25, "Receipt looks like an earlier one", "fnd_ta_image"),
      ev("se_ta_2", "2026-09-14T00:00:00Z", 25, "Hold released on review", "fnd_ta_image"),
      ev("se_ta_3", "2026-09-14T00:00:00Z", -12, "Weekend claim outside usual pattern", "fnd_ta_offpattern"),
    ],
    timeline: [
      { id: "tl_ta_1", at: "2026-08-22T00:00:00Z", kind: "FINDING", label: "Receipt looks like an earlier one", severity: "CASE" },
      { id: "tl_ta_2", at: "2026-09-14T00:00:00Z", kind: "DECISION", label: "Declined, hold released", severity: null },
    ],
  },
  {
    id: "usr_nakamura",
    name: "Grace Nakamura",
    department: "Finance",
    jobTitle: "Financial Analyst",
    scoreEvents: [
      ev("se_gn_1", "2026-08-28T00:00:00Z", -9, "Conference fare above own range", "fnd_gn_conference"),
    ],
    timeline: [
      { id: "tl_gn_1", at: "2026-08-28T00:00:00Z", kind: "EXPENSE", label: "Emerging Markets Summit", severity: null },
      { id: "tl_gn_2", at: "2026-08-28T00:00:00Z", kind: "FINDING", label: "Above own range, receipt matches", severity: "NOTE" },
    ],
  },
  {
    id: "usr_boateng",
    name: "Samuel Boateng",
    department: "Engineering",
    jobTitle: "Platform Engineer",
    scoreEvents: [
      ev("se_sb_1", "2026-09-09T00:00:00Z", -7, "Category does not match the merchant", "fnd_sb_category"),
    ],
    timeline: [
      { id: "tl_sb_1", at: "2026-09-09T00:00:00Z", kind: "FINDING", label: "Category does not match the merchant", severity: "NOTE" },
    ],
  },
  {
    id: "usr_lindqvist",
    name: "Elena Lindqvist",
    department: "Sales",
    jobTitle: "Sales Development Rep",
    scoreEvents: [ev("se_el_1", "2026-08-11T00:00:00Z", -5, "Round-amount claim", "fnd_el_round")],
    timeline: [
      { id: "tl_el_1", at: "2026-08-11T00:00:00Z", kind: "FINDING", label: "Round-amount claim", severity: "NOTE" },
    ],
  },
  { id: "usr_mwangi", name: "Joseph Mwangi", department: "Operations", jobTitle: "Operations Lead", scoreEvents: [], timeline: [] },
  { id: "usr_castellanos", name: "Rosa Castellanos", department: "Finance", jobTitle: "Accounts Payable", scoreEvents: [], timeline: [] },
  { id: "usr_whitfield", name: "Adam Whitfield", department: "Marketing", jobTitle: "Content Lead", scoreEvents: [], timeline: [] },
  { id: "usr_ferraro", name: "Lucia Ferraro", department: "Operations", jobTitle: "Logistics Coordinator", scoreEvents: [], timeline: [] },
];

export const CASES: AdminCase[] = [
  {
    id: "case_4471",
    subject: { id: "usr_reyes", name: "Marcus Reyes", department: "Sales" },
    status: "OPEN",
    severity: "CASE",
    amountAtRiskCents: 291500,
    openedAt: "2026-09-11T14:10:00Z",
    closedAt: null,
    decisionNote: null,
    findings: [
      {
        id: "fnd_reyes_outlier",
        ruleId: "EXP_AMOUNT_OUTLIER_SELF",
        subjectUserId: "usr_reyes",
        expenseIds: ["exp_reyes_dinner", "exp_reyes_air"],
        timesheetIds: [],
        confidence: 0.7,
        amountAtRiskCents: 204000,
        severity: "CASE",
        penaltyPoints: 9.8,
        evidence: [
          { label: "Claims in window", value: "4" },
          { label: "Usual per fortnight", value: "$475.00" },
          { label: "Largest single claim", value: "$1,180.00" },
          { label: "Robust z-score", value: "3.4" },
        ],
        detectedAt: "2026-09-11T14:10:00Z",
      },
      {
        id: "fnd_reyes_velocity",
        ruleId: "EXP_VELOCITY",
        subjectUserId: "usr_reyes",
        expenseIds: ["exp_reyes_hotel", "exp_reyes_car"],
        timesheetIds: [],
        confidence: 0.6,
        amountAtRiskCents: 87500,
        severity: "CASE",
        penaltyPoints: 6,
        evidence: [
          { label: "Claims in seven days", value: "4" },
          { label: "Own weekly baseline", value: "1.2" },
          { label: "Submitted within", value: "22 minutes" },
        ],
        detectedAt: "2026-09-11T14:10:00Z",
      },
    ],
    brief: {
      summary:
        "Four claims in the ten days to 11 September total $2,915.00, against a usual fortnightly range of $340 to $610 for this person. Three of the four were submitted within the same 22 minutes.",
      whyFlagged:
        "Two rules fired together. The first compares each claim against what this person normally claims in that category, using their own history rather than anyone else's. The second looks at how many claims arrive in a rolling seven days against their own usual pace. Neither says an amount is wrong, only that it sits well outside this person's established pattern.",
      reviewSteps: [
        "Open the largest claim, $1,180.00, and check whether it covers more than one person.",
        "Check whether a trip or client event falls in the ten-day window.",
        "Compare against the same period last year, when this person also claimed above their median.",
        "Look at whether the four claims share a merchant or a project code.",
      ],
      questionsForEmployee: [
        "Were these four claims part of a single trip or event?",
        "Can you tell us what the $1,180.00 claim on 9 September covers?",
        "Was there a reason several claims were submitted together that evening?",
      ],
      innocentExplanations: [
        "A backlog cleared in one sitting, which is why three arrived within 22 minutes rather than across the fortnight.",
        "A client event where one person pays for the group and claims the whole amount.",
        "A quarter-end push with more travel than this person's usual pattern reflects.",
      ],
      confidenceNote:
        "This evidence establishes that the claims sit outside this person's usual range and pace. It does not establish that any individual claim is incorrect.",
      policyReference: null,
    },
    documents: [
      { id: "exp_reyes_dinner", kind: "RECEIPT", label: "Client dinner, Austin", occurredOn: "2026-09-09", amountCents: 118000, hours: null, status: "SUBMITTED" },
      { id: "exp_reyes_air", kind: "RECEIPT", label: "Airfare, Austin", occurredOn: "2026-09-07", amountCents: 86000, hours: null, status: "SUBMITTED" },
      { id: "exp_reyes_hotel", kind: "RECEIPT", label: "Hotel, Austin", occurredOn: "2026-09-07", amountCents: 61200, hours: null, status: "SUBMITTED" },
      { id: "exp_reyes_car", kind: "RECEIPT", label: "Car hire, Austin", occurredOn: "2026-09-11", amountCents: 26300, hours: null, status: "SUBMITTED" },
    ],
    holds: [],
  },
  {
    id: "case_4468",
    subject: { id: "usr_okonkwo", name: "Daniel Okonkwo", department: "Field Operations" },
    status: "OPEN",
    severity: "CASE",
    amountAtRiskCents: 124000,
    openedAt: "2026-09-08T18:02:00Z",
    closedAt: null,
    decisionNote: null,
    findings: [
      {
        id: "fnd_okonkwo_location",
        ruleId: "TS_LOCATION_CONFLICT",
        subjectUserId: "usr_okonkwo",
        expenseIds: ["exp_ok_lunch"],
        timesheetIds: ["ts_ok_w37"],
        confidence: 0.85,
        amountAtRiskCents: 124000,
        severity: "CASE",
        penaltyPoints: 22.1,
        evidence: [
          { label: "Timesheet location", value: "Pittsburgh, PA" },
          { label: "Logged window", value: "09:00-17:00 EDT" },
          { label: "Merchant city", value: "Chicago, IL" },
          { label: "Receipt timestamp", value: "12:41 CDT" },
          { label: "Receipt amount", value: "$64.20" },
          { label: "Hours at risk", value: "8.00" },
        ],
        detectedAt: "2026-09-08T18:02:00Z",
      },
    ],
    brief: {
      summary:
        "On Tuesday 8 September, eight hours were logged at the Pittsburgh office between 09:00 and 17:00, while a lunch receipt for $64.20 was submitted from a merchant in Chicago timestamped 12:41. The two records cover the same window.",
      whyFlagged:
        "This rule compares the location written on a timesheet entry with the city of any expense made during those logged hours. When they name two different cities at the same moment, one of the two records is likely to be wrong. It does not tell us which one, and it does not tell us why.",
      reviewSteps: [
        "Open the receipt and confirm the merchant address really is Chicago, not a chain head office.",
        "Check the timesheet note field for a travel day or a client site.",
        "Look at the entries for Monday and Wednesday to see whether a trip was underway.",
        "Check whether a colleague submitted a matching Chicago receipt for the same meal.",
      ],
      questionsForEmployee: [
        "Can you confirm which office you worked from on 8 September?",
        "Was the 8 September lunch part of a client visit or a trip?",
        "Is the location on that week's timesheet the one you intended?",
      ],
      innocentExplanations: [
        "A travel day where the timesheet location was left on the usual office by default, which the form does not prompt to change.",
        "A meal paid for a colleague who was in Chicago, submitted by whoever held the company card.",
        "A merchant whose registered address differs from the branch actually visited.",
      ],
      confidenceNote:
        "This evidence establishes that two records disagree about location. It does not establish where the person actually was.",
      policyReference:
        "The travel policy states that meal expenses incurred while working away from an assigned office should be recorded against the trip, not the office day.",
    },
    documents: [
      { id: "exp_ok_lunch", kind: "RECEIPT", label: "Lou Malnati's, Chicago", occurredOn: "2026-09-08", amountCents: 6420, hours: null, status: "HELD" },
      { id: "ts_ok_w37", kind: "TIMESHEET", label: "Week of 07 Sep, Pittsburgh", occurredOn: "2026-09-07", amountCents: null, hours: "40.00", status: "SUBMITTED" },
    ],
    holds: [
      {
        id: "hold_ok_lunch",
        expenseId: "exp_ok_lunch",
        findingId: "fnd_okonkwo_location",
        amountCents: 6420,
        placedAt: "2026-09-08T18:02:00Z",
        releasedAt: null,
        releasedById: null,
        reverseNote: null,
      },
    ],
  },
  {
    id: "case_4462",
    subject: { id: "usr_venkatesan", name: "Priya Venkatesan", department: "Engineering" },
    status: "OPEN",
    severity: "IMMEDIATE_HOLD",
    amountAtRiskCents: 68400,
    openedAt: "2026-09-06T09:15:00Z",
    closedAt: null,
    decisionNote: null,
    findings: [
      {
        id: "fnd_priya_dup",
        ruleId: "DUP_RECEIPT_EXACT",
        subjectUserId: "usr_venkatesan",
        expenseIds: ["exp_pv_dell_2", "exp_pv_dell_1"],
        timesheetIds: [],
        confidence: 0.99,
        amountAtRiskCents: 68400,
        severity: "IMMEDIATE_HOLD",
        penaltyPoints: 29.7,
        evidence: [
          { label: "File fingerprint", value: "match, SHA-256" },
          { label: "First submitted", value: "2026-08-26" },
          { label: "Second submitted", value: "2026-09-06" },
          { label: "Merchant", value: "Dell Technologies" },
          { label: "Amount, both", value: "$684.00" },
          { label: "First claim status", value: "REIMBURSED" },
        ],
        detectedAt: "2026-09-06T09:15:00Z",
      },
    ],
    brief: {
      summary:
        "The same receipt file was submitted twice, eleven days apart, each time for $684.00. The two uploads are identical byte for byte. The second claim is held and unpaid.",
      whyFlagged:
        "This rule compares the digital fingerprint of every uploaded receipt against every receipt already on file. An exact match means the same file, not merely a similar purchase. It is the most certain of the duplicate checks, which is why the reimbursement was paused automatically rather than waiting in the queue.",
      reviewSteps: [
        "Open both claims side by side and confirm the amounts and dates match.",
        "Check whether the first claim was already reimbursed, which it was, on 2 September.",
        "Check the second claim's description for a note about a resubmission or a correction.",
        "Confirm no credit note or refund was recorded against the first claim.",
      ],
      questionsForEmployee: [
        "Was the 6 September submission intended to replace or correct the earlier one?",
        "Did you receive a notification that the August claim had been paid?",
        "Is there a second purchase from Dell that this receipt was meant to cover?",
      ],
      innocentExplanations: [
        "A resubmission after the first claim appeared to fail, which the form does not currently warn about.",
        "Two genuinely separate purchases of the same item where the wrong file was attached to the second.",
        "An expense tool sync that uploaded the same file twice without the person acting twice.",
      ],
      confidenceNote:
        "This evidence establishes that the same file supports two claims. It does not establish that a second payment was sought knowingly.",
      policyReference:
        "The expense policy states that each receipt may support one claim only, and that a replacement submission should reference the original.",
    },
    documents: [
      { id: "exp_pv_dell_2", kind: "RECEIPT", label: "Dell Technologies", occurredOn: "2026-09-06", amountCents: 68400, hours: null, status: "HELD" },
      { id: "exp_pv_dell_1", kind: "RECEIPT", label: "Dell Technologies", occurredOn: "2026-08-26", amountCents: 68400, hours: null, status: "REIMBURSED" },
    ],
    holds: [
      {
        id: "hold_pv_dell",
        expenseId: "exp_pv_dell_2",
        findingId: "fnd_priya_dup",
        amountCents: 68400,
        placedAt: "2026-09-06T09:15:00Z",
        releasedAt: null,
        releasedById: null,
        reverseNote: null,
      },
    ],
  },
  {
    id: "case_4459",
    subject: { id: "usr_kowalski", name: "Hannah Kowalski", department: "Marketing" },
    status: "OPEN",
    severity: "CASE",
    amountAtRiskCents: 50000,
    openedAt: "2026-09-03T11:40:00Z",
    closedAt: null,
    decisionNote: null,
    findings: [
      {
        id: "fnd_hk_round",
        ruleId: "EXP_ROUND_AMOUNT",
        subjectUserId: "usr_kowalski",
        expenseIds: ["exp_hk_united"],
        timesheetIds: [],
        confidence: 0.45,
        amountAtRiskCents: 50000,
        severity: "CASE",
        penaltyPoints: 2.25,
        evidence: [
          { label: "Claim amount", value: "$500.00" },
          { label: "Rounds to", value: "multiple of $50" },
          { label: "Approval threshold", value: "$500.00" },
          { label: "Receipt attached", value: "yes" },
          { label: "Merchant", value: "United Airlines" },
        ],
        detectedAt: "2026-09-03T11:40:00Z",
      },
    ],
    brief: {
      summary:
        "A travel claim for exactly $500.00 was submitted on 3 September. The amount is an exact multiple of $50 and sits at the threshold above which a second approval is required.",
      whyFlagged:
        "This rule notes high-value claims that land on an exactly round number. Real prices rarely do, so a round figure can indicate an estimate rather than a receipt total. It is the weakest signal in the catalogue and carries the lowest confidence of any rule, because plenty of genuine purchases are round.",
      reviewSteps: [
        "Open the attached receipt and check whether the printed total is also $500.00.",
        "Check whether the fare included a seat or bag fee that happens to round the total.",
        "Look at this person's other travel claims, which are not round.",
        "Confirm whether a second approval was recorded.",
      ],
      questionsForEmployee: [
        "Does the airline receipt show the same total as the claim?",
        "Was this fare booked as part of a package or a credit?",
        "Was any part of the fare paid with a voucher?",
      ],
      innocentExplanations: [
        "Airline fares are frequently set at round numbers, and a $500.00 fare is entirely ordinary.",
        "A travel credit applied to the booking brought the balance to a round figure.",
        "The receipt total genuinely is $500.00 and the roundness is a coincidence.",
      ],
      confidenceNote:
        "This evidence establishes only that the amount is round. It does not establish that the claim differs from the receipt.",
      policyReference: null,
    },
    documents: [
      { id: "exp_hk_united", kind: "RECEIPT", label: "United Airlines", occurredOn: "2026-09-03", amountCents: 50000, hours: null, status: "SUBMITTED" },
    ],
    holds: [],
  },
];

export const DOCUMENTS: DocumentRow[] = [
  { id: "exp_reyes_car", kind: "RECEIPT", occurredOn: "2026-09-11", employeeId: "usr_reyes", employeeName: "Marcus Reyes", label: "Car hire, Austin", categoryId: "Travel", amountCents: 26300, hours: null, status: "SUBMITTED", ruleId: "EXP_VELOCITY" },
  { id: "ts_gn_w37", kind: "TIMESHEET", occurredOn: "2026-09-10", employeeId: "usr_nakamura", employeeName: "Grace Nakamura", label: "Week of 07 Sep", categoryId: "Timesheet", amountCents: null, hours: "37.50", status: "APPROVED", ruleId: null },
  { id: "exp_reyes_dinner", kind: "RECEIPT", occurredOn: "2026-09-09", employeeId: "usr_reyes", employeeName: "Marcus Reyes", label: "Client dinner, Austin", categoryId: "Meals", amountCents: 118000, hours: null, status: "SUBMITTED", ruleId: "EXP_AMOUNT_OUTLIER_SELF" },
  { id: "exp_sb_jb", kind: "RECEIPT", occurredOn: "2026-09-09", employeeId: "usr_boateng", employeeName: "Samuel Boateng", label: "JetBrains", categoryId: "Software", amountCents: 21500, hours: null, status: "SUBMITTED", ruleId: "EXP_CATEGORY_MISMATCH" },
  { id: "exp_ok_lunch", kind: "RECEIPT", occurredOn: "2026-09-08", employeeId: "usr_okonkwo", employeeName: "Daniel Okonkwo", label: "Lou Malnati's, Chicago", categoryId: "Meals", amountCents: 6420, hours: null, status: "HELD", ruleId: "TS_LOCATION_CONFLICT" },
  { id: "ts_ok_w37", kind: "TIMESHEET", occurredOn: "2026-09-07", employeeId: "usr_okonkwo", employeeName: "Daniel Okonkwo", label: "Week of 07 Sep", categoryId: "Timesheet", amountCents: null, hours: "40.00", status: "SUBMITTED", ruleId: "TS_LOCATION_CONFLICT" },
  { id: "exp_reyes_air", kind: "RECEIPT", occurredOn: "2026-09-07", employeeId: "usr_reyes", employeeName: "Marcus Reyes", label: "Airfare, Austin", categoryId: "Travel", amountCents: 86000, hours: null, status: "SUBMITTED", ruleId: "EXP_VELOCITY" },
  { id: "exp_reyes_hotel", kind: "RECEIPT", occurredOn: "2026-09-07", employeeId: "usr_reyes", employeeName: "Marcus Reyes", label: "Hotel, Austin", categoryId: "Lodging", amountCents: 61200, hours: null, status: "SUBMITTED", ruleId: "EXP_VELOCITY" },
  { id: "exp_pv_dell_2", kind: "RECEIPT", occurredOn: "2026-09-06", employeeId: "usr_venkatesan", employeeName: "Priya Venkatesan", label: "Dell Technologies", categoryId: "Supplies", amountCents: 68400, hours: null, status: "HELD", ruleId: "DUP_RECEIPT_EXACT" },
  { id: "exp_ta_shell", kind: "RECEIPT", occurredOn: "2026-09-05", employeeId: "usr_alvarez", employeeName: "Tomas Alvarez", label: "Shell", categoryId: "Travel", amountCents: 7215, hours: null, status: "REIMBURSED", ruleId: null },
  { id: "exp_ok_hyatt", kind: "RECEIPT", occurredOn: "2026-09-04", employeeId: "usr_okonkwo", employeeName: "Daniel Okonkwo", label: "Hyatt Regency, Pittsburgh", categoryId: "Lodging", amountCents: 41200, hours: null, status: "REIMBURSED", ruleId: null },
  { id: "exp_hk_united", kind: "RECEIPT", occurredOn: "2026-09-03", employeeId: "usr_kowalski", employeeName: "Hannah Kowalski", label: "United Airlines", categoryId: "Travel", amountCents: 50000, hours: null, status: "SUBMITTED", ruleId: "EXP_ROUND_AMOUNT" },
  { id: "exp_pv_gh", kind: "RECEIPT", occurredOn: "2026-09-03", employeeId: "usr_venkatesan", employeeName: "Priya Venkatesan", label: "GitHub", categoryId: "Software", amountCents: 8400, hours: null, status: "APPROVED", ruleId: null },
  { id: "exp_ok_cafe", kind: "RECEIPT", occurredOn: "2026-09-02", employeeId: "usr_okonkwo", employeeName: "Daniel Okonkwo", label: "Duquesne Cafe", categoryId: "Meals", amountCents: 1875, hours: null, status: "APPROVED", ruleId: null },
  { id: "exp_gn_delta", kind: "RECEIPT", occurredOn: "2026-09-02", employeeId: "usr_nakamura", employeeName: "Grace Nakamura", label: "Delta Air Lines", categoryId: "Travel", amountCents: 41000, hours: null, status: "REIMBURSED", ruleId: null },
  { id: "exp_hk_adobe", kind: "RECEIPT", occurredOn: "2026-09-01", employeeId: "usr_kowalski", employeeName: "Hannah Kowalski", label: "Adobe", categoryId: "Software", amountCents: 5999, hours: null, status: "REIMBURSED", ruleId: null },
  { id: "ts_ok_w36", kind: "TIMESHEET", occurredOn: "2026-08-31", employeeId: "usr_okonkwo", employeeName: "Daniel Okonkwo", label: "Week of 31 Aug", categoryId: "Timesheet", amountCents: null, hours: "38.50", status: "APPROVED", ruleId: null },
  { id: "ts_ta_w35", kind: "TIMESHEET", occurredOn: "2026-08-30", employeeId: "usr_alvarez", employeeName: "Tomas Alvarez", label: "Week of 24 Aug", categoryId: "Timesheet", amountCents: null, hours: "44.00", status: "APPROVED", ruleId: null },
  { id: "exp_gn_summit", kind: "RECEIPT", occurredOn: "2026-08-28", employeeId: "usr_nakamura", employeeName: "Grace Nakamura", label: "Emerging Markets Summit", categoryId: "Training", amountCents: 320000, hours: null, status: "APPROVED", ruleId: "EXP_AMOUNT_OUTLIER_SELF" },
  { id: "exp_hk_marriott", kind: "RECEIPT", occurredOn: "2026-08-28", employeeId: "usr_kowalski", employeeName: "Hannah Kowalski", label: "Marriott, Denver", categoryId: "Lodging", amountCents: 32840, hours: null, status: "APPROVED", ruleId: null },
  { id: "exp_ok_cab", kind: "RECEIPT", occurredOn: "2026-08-26", employeeId: "usr_okonkwo", employeeName: "Daniel Okonkwo", label: "Yellow Cab", categoryId: "Travel", amountCents: 4760, hours: null, status: "REIMBURSED", ruleId: null },
  { id: "exp_pv_dell_1", kind: "RECEIPT", occurredOn: "2026-08-26", employeeId: "usr_venkatesan", employeeName: "Priya Venkatesan", label: "Dell Technologies", categoryId: "Supplies", amountCents: 68400, hours: null, status: "REIMBURSED", ruleId: null },
  { id: "exp_reyes_sf", kind: "RECEIPT", occurredOn: "2026-08-24", employeeId: "usr_reyes", employeeName: "Marcus Reyes", label: "Salesforce", categoryId: "Software", amountCents: 18000, hours: null, status: "REIMBURSED", ruleId: null },
  { id: "exp_ta_bakery", kind: "RECEIPT", occurredOn: "2026-08-22", employeeId: "usr_alvarez", employeeName: "Tomas Alvarez", label: "Corner Bakery", categoryId: "Meals", amountCents: 48000, hours: null, status: "REIMBURSED", ruleId: "DUP_RECEIPT_IMAGE" },
  { id: "exp_sb_staples", kind: "RECEIPT", occurredOn: "2026-08-20", employeeId: "usr_boateng", employeeName: "Samuel Boateng", label: "Staples", categoryId: "Supplies", amountCents: 4680, hours: null, status: "REIMBURSED", ruleId: null },
  { id: "ts_pv_w34", kind: "TIMESHEET", occurredOn: "2026-08-19", employeeId: "usr_venkatesan", employeeName: "Priya Venkatesan", label: "Week of 17 Aug", categoryId: "Timesheet", amountCents: null, hours: "41.25", status: "APPROVED", ruleId: null },
];

export const AUDIT: AuditEntry[] = [
  {
    id: "aud_5",
    actorId: "usr_admin",
    actorName: "K. Salama",
    action: "HOLD_REVERSED",
    targetType: "Hold",
    targetId: "hold_ta_bakery",
    detail: "Released a hold on Tomas Alvarez, $480.00 reimbursed. Receipt was a re-photograph of a meal already claimed once.",
    isSelfReview: false,
    createdAt: "2026-09-14T13:41:00Z",
  },
  {
    id: "aud_4",
    actorId: "usr_admin",
    actorName: "K. Salama",
    action: "CASE_DECIDED",
    targetType: "Case",
    targetId: "case_4455",
    detail: "Declined. Conference fare confirmed against the invoice.",
    isSelfReview: false,
    createdAt: "2026-09-14T13:38:00Z",
  },
  {
    id: "aud_3",
    actorId: "usr_admin",
    actorName: "K. Salama",
    action: "CASE_DECIDED",
    targetType: "Case",
    targetId: "case_4451",
    detail: "Accepted. Reviewed by a second administrator.",
    isSelfReview: true,
    createdAt: "2026-09-13T20:02:00Z",
  },
  {
    id: "aud_2",
    actorId: "usr_admin",
    actorName: "K. Salama",
    action: "CASE_QUESTION",
    targetType: "Case",
    targetId: "case_4462",
    detail: "Asked: how certain is an exact receipt match?",
    isSelfReview: false,
    createdAt: "2026-09-13T15:20:00Z",
  },
  {
    id: "aud_1",
    actorId: "usr_admin",
    actorName: "K. Salama",
    action: "POLICY_UPLOADED",
    targetType: "Policy",
    targetId: "pol_travel_2026",
    detail: "Travel and expense policy 2026, 34 passages indexed.",
    isSelfReview: false,
    createdAt: "2026-09-12T18:55:00Z",
  },
];

/** Twelve weeks to 14 September, Mondays. Charts read these buckets directly. */
export const WEEK_STARTS = [
  "2026-06-29", "2026-07-06", "2026-07-13", "2026-07-20", "2026-07-27", "2026-08-03",
  "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31", "2026-09-07", "2026-09-14",
];

export const FINDINGS_BY_WEEK = [
  { duplicate: 2, expense: 5, timesheet: 1 },
  { duplicate: 3, expense: 6, timesheet: 2 },
  { duplicate: 1, expense: 4, timesheet: 2 },
  { duplicate: 4, expense: 7, timesheet: 3 },
  { duplicate: 3, expense: 8, timesheet: 2 },
  { duplicate: 5, expense: 6, timesheet: 4 },
  { duplicate: 4, expense: 9, timesheet: 3 },
  { duplicate: 6, expense: 7, timesheet: 2 },
  { duplicate: 5, expense: 8, timesheet: 3 },
  { duplicate: 4, expense: 6, timesheet: 4 },
  { duplicate: 3, expense: 5, timesheet: 3 },
  { duplicate: 2, expense: 6, timesheet: 2 },
];

/** Running totals in cents. */
export const MONEY_BY_WEEK = [
  { heldCents: 400000, releasedCents: 100000, confirmedCents: 0 },
  { heldCents: 700000, releasedCents: 200000, confirmedCents: 100000 },
  { heldCents: 900000, releasedCents: 400000, confirmedCents: 100000 },
  { heldCents: 1200000, releasedCents: 500000, confirmedCents: 200000 },
  { heldCents: 1400000, releasedCents: 700000, confirmedCents: 300000 },
  { heldCents: 1700000, releasedCents: 800000, confirmedCents: 300000 },
  { heldCents: 1900000, releasedCents: 1000000, confirmedCents: 400000 },
  { heldCents: 2200000, releasedCents: 1200000, confirmedCents: 500000 },
  { heldCents: 2400000, releasedCents: 1300000, confirmedCents: 600000 },
  { heldCents: 2600000, releasedCents: 1500000, confirmedCents: 600000 },
  { heldCents: 2800000, releasedCents: 1600000, confirmedCents: 700000 },
  { heldCents: 3000000, releasedCents: 1800000, confirmedCents: 800000 },
];

export const SEVERITY_BY_WEEK = [
  { immediateHold: 1, case: 3, note: 4 }, { immediateHold: 1, case: 4, note: 3 },
  { immediateHold: 2, case: 2, note: 5 }, { immediateHold: 1, case: 5, note: 4 },
  { immediateHold: 2, case: 3, note: 6 }, { immediateHold: 2, case: 6, note: 4 },
  { immediateHold: 1, case: 4, note: 5 }, { immediateHold: 2, case: 3, note: 6 },
  { immediateHold: 1, case: 4, note: 4 }, { immediateHold: 2, case: 5, note: 3 },
  { immediateHold: 1, case: 3, note: 5 }, { immediateHold: 1, case: 4, note: 4 },
];

export const CATEGORY_SPEND = [
  { categoryId: "Travel", spendCents: 4200000, departmentMedianCents: 3100000 },
  { categoryId: "Meals", spendCents: 2800000, departmentMedianCents: 3100000 },
  { categoryId: "Software", spendCents: 3500000, departmentMedianCents: 3100000 },
  { categoryId: "Lodging", spendCents: 5100000, departmentMedianCents: 3100000 },
  { categoryId: "Supplies", spendCents: 1200000, departmentMedianCents: 3100000 },
  { categoryId: "Training", spendCents: 1900000, departmentMedianCents: 3100000 },
];

export const DECIDED_THIS_WEEK = 7;
