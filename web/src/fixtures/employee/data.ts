import type {
  OwnExpense,
  OwnFinding,
  OwnHold,
  OwnScore,
  OwnTimesheet,
} from "@/contracts/employee";

export const FIXTURE_EMPLOYEE_IDS = {
  clean: "emp_clean",
  held: "emp_held",
  remote: "emp_remote",
} as const;

export const FIXTURE_EMPLOYEES = {
  [FIXTURE_EMPLOYEE_IDS.clean]: {
    name: "Priya Nair",
    department: "Engineering",
    email: "priya.nair@auditx.local",
  },
  [FIXTURE_EMPLOYEE_IDS.held]: {
    name: "Jamie Okafor",
    department: "Sales",
    email: "employee@auditx.local",
  },
  [FIXTURE_EMPLOYEE_IDS.remote]: {
    name: "Alex Chen",
    department: "Product",
    email: "alex.chen@auditx.local",
  },
} as const;

/** Plain-language copy used by findings, holds and score events. Never accuse. */
export const REASONS = {
  duplicate: "This receipt looks the same as one submitted on 3 March.",
  duplicateNext:
    "A reviewer will compare the two receipts. You can add a note from your record if they ask.",
  holdBanner:
    "This reimbursement is paused while a reviewer looks at it. Here is why: this receipt looks the same as one submitted on 3 March.",
  holdNext:
    "A reviewer will look at the two receipts, then release the reimbursement or ask you a question.",
  locationConflict:
    "Your timesheet says Pittsburgh office on Tuesday, and a receipt that day is from Chicago.",
  locationNext: "You can correct the location on that timesheet or reply when a reviewer asks.",
  conference:
    "This travel amount is larger than your usual claims. It is recorded as a note, not a hold.",
  conferenceNext: "No action is needed unless a reviewer asks about the conference.",
  parking:
    "This parking charge matches a daily pattern that already appears on your record. Reviewed, no action taken.",
  parkingNext: "Nothing is paused. Keep submitting the usual daily parking charge as you do now.",
  scoreDuplicate: "Score rose after a receipt was flagged as looking the same as an earlier one.",
  scoreLocation: "Score rose after a timesheet location did not match a receipt city on the same day.",
  scoreConference: "Score rose slightly after a large travel claim was recorded as a note.",
  scoreParking: "Score unchanged after a parking charge was reviewed and no action was taken.",
} as const;

const RECEIPT_DUP = {
  id: "rec_dup_original",
  storageKey: "receipts/fixture/dup-original.jpg",
  mimeType: "image/jpeg",
  sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
};

const RECEIPT_DUP_RESUBMIT = {
  ...RECEIPT_DUP,
  id: "rec_dup_resubmit",
  storageKey: "receipts/fixture/dup-resubmit.jpg",
};

const field = <T>(value: T, confidence: number) => ({ value, confidence });

function extraction(opts: {
  merchant: string;
  date: string;
  totalCents: number;
  city?: string;
  time?: string;
  merchantConf?: number;
  dateConf?: number;
  totalConf?: number;
  corrected?: Array<"merchantName" | "transactionDate" | "totalCents">;
}) {
  return {
    merchantName: field(opts.merchant, opts.merchantConf ?? 0.95),
    transactionDate: field(opts.date, opts.dateConf ?? 0.93),
    totalCents: field(opts.totalCents, opts.totalConf ?? 0.97),
    merchantCity: opts.city ? field(opts.city, 0.88) : null,
    transactionTime: opts.time ? field(opts.time, 0.8) : null,
    legibility: 0.9,
    correctedFields: opts.corrected ?? [],
  };
}

export const expenses: OwnExpense[] = [
  {
    id: "exp_clean_lunch",
    userId: FIXTURE_EMPLOYEE_IDS.clean,
    submittedAt: "2026-09-10T15:04:00.000Z",
    incurredAt: "2026-09-09T16:30:00.000Z",
    merchantRaw: "Union Hall Coffee",
    categoryId: "Meals",
    amountCents: 1280,
    currency: "USD",
    description: "Team lunch after sprint review",
    receipt: {
      id: "rec_clean_lunch",
      storageKey: "receipts/fixture/clean-lunch.jpg",
      mimeType: "image/jpeg",
      sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    },
    status: "REIMBURSED",
    statusHistory: [
      { status: "SUBMITTED", at: "2026-09-10T15:04:00.000Z" },
      { status: "APPROVED", at: "2026-09-11T11:00:00.000Z" },
      { status: "REIMBURSED", at: "2026-09-18T09:00:00.000Z" },
    ],
    extraction: extraction({
      merchant: "Union Hall Coffee",
      date: "2026-09-09",
      totalCents: 1280,
      city: "Pittsburgh",
    }),
  },
  {
    id: "exp_clean_supplies",
    userId: FIXTURE_EMPLOYEE_IDS.clean,
    submittedAt: "2026-08-21T18:12:00.000Z",
    incurredAt: "2026-08-20T14:00:00.000Z",
    merchantRaw: "Office Depot",
    categoryId: "Supplies",
    amountCents: 2465,
    currency: "USD",
    description: "Notebooks and printer paper",
    receipt: {
      id: "rec_clean_supplies",
      storageKey: "receipts/fixture/clean-supplies.jpg",
      mimeType: "image/jpeg",
      sha256: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    },
    status: "APPROVED",
    statusHistory: [
      { status: "SUBMITTED", at: "2026-08-21T18:12:00.000Z" },
      { status: "APPROVED", at: "2026-08-22T10:30:00.000Z" },
    ],
    extraction: extraction({
      merchant: "Office Depot",
      date: "2026-08-20",
      totalCents: 2465,
      city: "Pittsburgh",
    }),
  },
  {
    id: "exp_dup_original",
    userId: FIXTURE_EMPLOYEE_IDS.held,
    submittedAt: "2026-03-04T20:10:00.000Z",
    incurredAt: "2026-03-03T19:15:00.000Z",
    merchantRaw: "The Commoner",
    categoryId: "Meals",
    amountCents: 4720,
    currency: "USD",
    description: "Client dinner",
    receipt: RECEIPT_DUP,
    status: "REIMBURSED",
    statusHistory: [
      { status: "SUBMITTED", at: "2026-03-04T20:10:00.000Z" },
      { status: "APPROVED", at: "2026-03-05T13:00:00.000Z" },
      { status: "REIMBURSED", at: "2026-03-12T09:00:00.000Z" },
    ],
    extraction: extraction({
      merchant: "The Commoner",
      date: "2026-03-03",
      totalCents: 4720,
      city: "Pittsburgh",
      time: "19:15",
    }),
  },
  {
    id: "exp_dup_resubmit",
    userId: FIXTURE_EMPLOYEE_IDS.held,
    submittedAt: "2026-03-24T16:40:00.000Z",
    incurredAt: "2026-03-03T19:15:00.000Z",
    merchantRaw: "The Commoner",
    categoryId: "Meals",
    amountCents: 4720,
    currency: "USD",
    description: "Client dinner",
    receipt: RECEIPT_DUP_RESUBMIT,
    status: "HELD",
    statusHistory: [
      { status: "SUBMITTED", at: "2026-03-24T16:40:00.000Z" },
      { status: "HELD", at: "2026-03-24T16:41:00.000Z" },
    ],
    extraction: extraction({
      merchant: "The Commoner",
      date: "2026-03-03",
      totalCents: 4720,
      city: "Pittsburgh",
      time: "19:15",
      merchantConf: 0.62,
      corrected: ["merchantName"],
    }),
  },
  {
    id: "exp_chicago_lunch",
    userId: FIXTURE_EMPLOYEE_IDS.held,
    submittedAt: "2026-09-15T14:05:00.000Z",
    incurredAt: "2026-09-08T16:40:00.000Z",
    merchantRaw: "Lou Malnati's",
    categoryId: "Meals",
    amountCents: 1840,
    currency: "USD",
    description: "Lunch while travelling",
    receipt: {
      id: "rec_chicago_lunch",
      storageKey: "receipts/fixture/chicago-lunch.jpg",
      mimeType: "image/jpeg",
      sha256: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    },
    status: "SUBMITTED",
    statusHistory: [{ status: "SUBMITTED", at: "2026-09-15T14:05:00.000Z" }],
    extraction: extraction({
      merchant: "Lou Malnati's",
      date: "2026-09-08",
      totalCents: 1840,
      city: "Chicago",
      time: "12:40",
    }),
  },
  {
    id: "exp_conference",
    userId: FIXTURE_EMPLOYEE_IDS.held,
    submittedAt: "2026-08-13T11:22:00.000Z",
    incurredAt: "2026-08-12T13:00:00.000Z",
    merchantRaw: "SaaStr Annual",
    categoryId: "Training",
    amountCents: 320000,
    currency: "USD",
    description: "Conference ticket",
    receipt: {
      id: "rec_conference",
      storageKey: "receipts/fixture/conference.jpg",
      mimeType: "image/jpeg",
      sha256: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    },
    status: "APPROVED",
    statusHistory: [
      { status: "SUBMITTED", at: "2026-08-13T11:22:00.000Z" },
      { status: "APPROVED", at: "2026-08-14T09:15:00.000Z" },
    ],
    extraction: extraction({
      merchant: "SaaStr Annual",
      date: "2026-08-12",
      totalCents: 320000,
      city: "San Francisco",
    }),
  },
  {
    id: "exp_parking",
    userId: FIXTURE_EMPLOYEE_IDS.held,
    submittedAt: "2026-09-02T21:00:00.000Z",
    incurredAt: "2026-09-02T12:00:00.000Z",
    merchantRaw: "Pittsburgh Parking Authority",
    categoryId: "Transport",
    amountCents: 450,
    currency: "USD",
    description: "Daily parking",
    receipt: {
      id: "rec_parking",
      storageKey: "receipts/fixture/parking.jpg",
      mimeType: "image/jpeg",
      sha256: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    },
    status: "APPROVED",
    statusHistory: [
      { status: "SUBMITTED", at: "2026-09-02T21:00:00.000Z" },
      { status: "APPROVED", at: "2026-09-03T08:40:00.000Z" },
    ],
    extraction: extraction({
      merchant: "Pittsburgh Parking Authority",
      date: "2026-09-02",
      totalCents: 450,
      city: "Pittsburgh",
    }),
  },
  {
    id: "exp_remote_lunch",
    userId: FIXTURE_EMPLOYEE_IDS.remote,
    submittedAt: "2026-09-09T22:10:00.000Z",
    incurredAt: "2026-09-08T16:40:00.000Z",
    merchantRaw: "Lou Malnati's",
    categoryId: "Meals",
    amountCents: 2215,
    currency: "USD",
    description: "Lunch on a remote-work day",
    receipt: {
      id: "rec_remote_lunch",
      storageKey: "receipts/fixture/remote-lunch.jpg",
      mimeType: "image/jpeg",
      sha256: "1111111111111111111111111111111111111111111111111111111111111111",
    },
    status: "SUBMITTED",
    statusHistory: [{ status: "SUBMITTED", at: "2026-09-09T22:10:00.000Z" }],
    extraction: extraction({
      merchant: "Lou Malnati's",
      date: "2026-09-08",
      totalCents: 2215,
      city: "Chicago",
      time: "12:40",
    }),
  },
];

function weekdayEntries(
  timesheetId: string,
  weekStart: string,
  location: string,
): OwnTimesheet["entries"] {
  const monday = new Date(weekStart);
  return [0, 1, 2, 3, 4].map((offset) => {
    const day = new Date(monday);
    day.setUTCDate(monday.getUTCDate() + offset);
    const date = day.toISOString().slice(0, 10);
    return {
      id: `${timesheetId}_d${offset}`,
      workDate: `${date}T00:00:00.000Z`,
      startTime: `${date}T13:00:00.000Z`,
      endTime: `${date}T21:00:00.000Z`,
      hours: "8.00",
      project: "Core",
      location,
      note: null,
    };
  });
}

export const timesheets: OwnTimesheet[] = [
  {
    id: "ts_clean_week",
    userId: FIXTURE_EMPLOYEE_IDS.clean,
    weekStart: "2026-09-07T00:00:00.000Z",
    submittedAt: "2026-09-11T18:00:00.000Z",
    status: "APPROVED",
    statusHistory: [
      { status: "SUBMITTED", at: "2026-09-11T18:00:00.000Z" },
      { status: "APPROVED", at: "2026-09-12T09:00:00.000Z" },
    ],
    entries: weekdayEntries("ts_clean_week", "2026-09-07T00:00:00.000Z", "Pittsburgh office"),
  },
  {
    id: "ts_held_conflict",
    userId: FIXTURE_EMPLOYEE_IDS.held,
    weekStart: "2026-09-07T00:00:00.000Z",
    submittedAt: "2026-09-11T19:30:00.000Z",
    status: "SUBMITTED",
    statusHistory: [{ status: "SUBMITTED", at: "2026-09-11T19:30:00.000Z" }],
    entries: weekdayEntries("ts_held_conflict", "2026-09-07T00:00:00.000Z", "Pittsburgh office"),
  },
  {
    id: "ts_remote_chicago",
    userId: FIXTURE_EMPLOYEE_IDS.remote,
    weekStart: "2026-09-07T00:00:00.000Z",
    submittedAt: "2026-09-11T17:10:00.000Z",
    status: "SUBMITTED",
    statusHistory: [{ status: "SUBMITTED", at: "2026-09-11T17:10:00.000Z" }],
    entries: weekdayEntries("ts_remote_chicago", "2026-09-07T00:00:00.000Z", "Chicago"),
  },
];

export const findings: OwnFinding[] = [
  {
    id: "fnd_dup",
    userId: FIXTURE_EMPLOYEE_IDS.held,
    ruleId: "DUP_RECEIPT_EXACT",
    expenseIds: ["exp_dup_original", "exp_dup_resubmit"],
    timesheetIds: [],
    amountAtRiskCents: 4720,
    severity: "IMMEDIATE_HOLD",
    detectedAt: "2026-03-24T16:41:00.000Z",
    incurredOn: "2026-03-03T19:15:00.000Z",
    reason: REASONS.duplicate,
    nextStep: REASONS.duplicateNext,
    reviewStatus: "PENDING_REVIEW",
  },
  {
    id: "fnd_location",
    userId: FIXTURE_EMPLOYEE_IDS.held,
    ruleId: "TS_LOCATION_CONFLICT",
    expenseIds: ["exp_chicago_lunch"],
    timesheetIds: ["ts_held_conflict"],
    amountAtRiskCents: 1840,
    severity: "CASE",
    detectedAt: "2026-09-15T14:06:00.000Z",
    incurredOn: "2026-09-08T16:40:00.000Z",
    reason: REASONS.locationConflict,
    nextStep: REASONS.locationNext,
    reviewStatus: "PENDING_REVIEW",
  },
  {
    id: "fnd_conference",
    userId: FIXTURE_EMPLOYEE_IDS.held,
    ruleId: "EXP_AMOUNT_OUTLIER_SELF",
    expenseIds: ["exp_conference"],
    timesheetIds: [],
    amountAtRiskCents: 320000,
    severity: "NOTE",
    detectedAt: "2026-08-13T11:23:00.000Z",
    incurredOn: "2026-08-12T13:00:00.000Z",
    reason: REASONS.conference,
    nextStep: REASONS.conferenceNext,
    reviewStatus: "PENDING_REVIEW",
  },
  {
    id: "fnd_parking",
    userId: FIXTURE_EMPLOYEE_IDS.held,
    ruleId: "DUP_RECEIPT_FIELDS",
    expenseIds: ["exp_parking"],
    timesheetIds: [],
    amountAtRiskCents: 450,
    severity: "CASE",
    detectedAt: "2026-09-02T21:01:00.000Z",
    incurredOn: "2026-09-02T12:00:00.000Z",
    reason: REASONS.parking,
    nextStep: REASONS.parkingNext,
    reviewStatus: "NO_ACTION",
  },
];

export const holds: OwnHold[] = [
  {
    id: "hold_dup",
    expenseId: "exp_dup_resubmit",
    findingId: "fnd_dup",
    placedAt: "2026-03-24T16:41:00.000Z",
    releasedAt: null,
    reason: REASONS.holdBanner,
    nextStep: REASONS.holdNext,
  },
];

function sixMonthHistory(values: number[]): OwnScore["history"] {
  const months = ["04", "05", "06", "07", "08", "09"];
  return months.map((month, i) => ({
    asOf: `2026-${month}-01T00:00:00.000Z`,
    value: values[i] ?? 0,
  }));
}

export const scores: OwnScore[] = [
  {
    userId: FIXTURE_EMPLOYEE_IDS.clean,
    value: 0,
    asOf: "2026-09-19T00:00:00.000Z",
    history: sixMonthHistory([0, 0, 0, 0, 0, 0]),
    events: [],
  },
  {
    userId: FIXTURE_EMPLOYEE_IDS.held,
    value: 23,
    asOf: "2026-09-19T00:00:00.000Z",
    history: sixMonthHistory([0, 0, 12, 12, 13, 23]),
    events: [
      {
        id: "sev_dup",
        findingId: "fnd_dup",
        delta: 12,
        reason: REASONS.scoreDuplicate,
        createdAt: "2026-03-24T16:41:00.000Z",
      },
      {
        id: "sev_conference",
        findingId: "fnd_conference",
        delta: 1,
        reason: REASONS.scoreConference,
        createdAt: "2026-08-13T11:23:00.000Z",
      },
      {
        id: "sev_parking",
        findingId: "fnd_parking",
        delta: 0,
        reason: REASONS.scoreParking,
        createdAt: "2026-09-03T08:40:00.000Z",
      },
      {
        id: "sev_location",
        findingId: "fnd_location",
        delta: 10,
        reason: REASONS.scoreLocation,
        createdAt: "2026-09-15T14:06:00.000Z",
      },
    ],
  },
  {
    userId: FIXTURE_EMPLOYEE_IDS.remote,
    value: 0,
    asOf: "2026-09-19T00:00:00.000Z",
    history: sixMonthHistory([0, 0, 0, 0, 0, 0]),
    events: [],
  },
];

export function fixtureCopy(): string[] {
  const fromFindings = findings.flatMap((f) => [f.reason, f.nextStep]);
  const fromHolds = holds.flatMap((h) => [h.reason, h.nextStep]);
  const fromEvents = scores.flatMap((s) => s.events.map((e) => e.reason));
  return [...Object.values(REASONS), ...fromFindings, ...fromHolds, ...fromEvents];
}
