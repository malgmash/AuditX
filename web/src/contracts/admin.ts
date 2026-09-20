// Types the administrator UI reads and writes. Owned by the admin stream.
// Money is integer cents. Timestamps are ISO 8601 in UTC. Formatting happens at the edge.

export type Severity = "IMMEDIATE_HOLD" | "CASE" | "NOTE";
export type CaseStatus = "OPEN" | "ACCEPTED" | "DECLINED" | "ESCALATED";
export type CaseDecision = "ACCEPTED" | "DECLINED";
export type ExpenseStatus = "SUBMITTED" | "APPROVED" | "HELD" | "DECLINED" | "REIMBURSED";
export type TimesheetStatus = "SUBMITTED" | "APPROVED" | "DECLINED";

/** One row of the employee table. This screen is where the administrator lives. */
export type EmployeeRow = {
  id: string;
  name: string;
  department: string;
  /** 0 to 100. Ranks the queue and never acts on its own. */
  score: number;
  openCases: number;
  amountAtRiskCents: number;
};

export type EmployeeSortKey = "name" | "department" | "score" | "openCases" | "amountAtRisk";
export type SortDirection = "asc" | "desc";

export type ScorePoint = {
  asOf: string;
  value: number;
};

/**
 * Append-only. A reversal is a new event restoring the points, never an edit to an old one.
 * The score is derived by summing these, so a reversal returns it to its exact prior value.
 */
export type ScoreEvent = {
  id: string;
  findingId: string | null;
  delta: number;
  reason: string;
  createdAt: string;
};

/** Evidence is whatever the detector recorded. Rendered as label and raw value in the mono style. */
export type EvidenceRow = {
  label: string;
  value: string;
};

export type Finding = {
  id: string;
  ruleId: string;
  subjectUserId: string;
  expenseIds: string[];
  timesheetIds: string[];
  /** 0 to 1, as assigned by the rule. */
  confidence: number;
  amountAtRiskCents: number;
  severity: Severity;
  penaltyPoints: number;
  evidence: EvidenceRow[];
  detectedAt: string;
};

/**
 * Written by the investigator. `innocentExplanations` is required and must hold at least two:
 * it is what keeps the brief a judgement rather than a prosecution.
 */
export type CaseBrief = {
  summary: string;
  whyFlagged: string;
  reviewSteps: string[];
  questionsForEmployee: string[];
  innocentExplanations: string[];
  confidenceNote: string;
  /** States what a policy says, never whether it was followed. Null when none applies. */
  policyReference: string | null;
};

export type LinkedDocument = {
  id: string;
  kind: "RECEIPT" | "TIMESHEET";
  label: string;
  occurredOn: string;
  /** Cents for a receipt, null for a timesheet. */
  amountCents: number | null;
  /** Hours to two decimals as a string for a timesheet, null for a receipt. */
  hours: string | null;
  status: ExpenseStatus | TimesheetStatus;
};

export type Hold = {
  id: string;
  expenseId: string;
  findingId: string;
  amountCents: number;
  placedAt: string;
  releasedAt: string | null;
  releasedById: string | null;
  reverseNote: string | null;
};

export type AdminCase = {
  id: string;
  subject: { id: string; name: string; department: string };
  status: CaseStatus;
  severity: Severity;
  amountAtRiskCents: number;
  openedAt: string;
  closedAt: string | null;
  decisionNote: string | null;
  findings: Finding[];
  brief: CaseBrief;
  documents: LinkedDocument[];
  holds: Hold[];
};

/** A point on the employee timeline. Laid out on a real date axis so spacing is visible. */
export type TimelineEvent = {
  id: string;
  at: string;
  kind: "EXPENSE" | "TIMESHEET" | "FINDING" | "HOLD" | "DECISION";
  label: string;
  severity: Severity | null;
};

export type EmployeeDetail = {
  id: string;
  name: string;
  department: string;
  jobTitle: string;
  score: number;
  scoreHistory: ScorePoint[];
  scoreEvents: ScoreEvent[];
  amountAtRiskCents: number;
  findings: Finding[];
  documents: LinkedDocument[];
  timeline: TimelineEvent[];
};

export type DocumentRow = {
  id: string;
  kind: "RECEIPT" | "TIMESHEET";
  occurredOn: string;
  employeeId: string;
  employeeName: string;
  label: string;
  categoryId: string;
  amountCents: number | null;
  hours: string | null;
  status: ExpenseStatus | TimesheetStatus;
  ruleId: string | null;
};

export type DocumentFilters = {
  employeeId?: string;
  month?: string;
  categoryId?: string;
  status?: string;
};

/** One bucket per week. Feeds the four charts, so section 7 reshapes nothing. */
export type WeeklyFindingPoint = {
  weekStart: string;
  duplicate: number;
  expense: number;
  timesheet: number;
};

export type WeeklyMoneyPoint = {
  weekStart: string;
  heldCents: number;
  releasedCents: number;
  confirmedCents: number;
};

export type WeeklySeverityPoint = {
  weekStart: string;
  immediateHold: number;
  case: number;
  note: number;
};

export type CategorySpendPoint = {
  categoryId: string;
  spendCents: number;
  departmentMedianCents: number;
};

export type AdminStats = {
  openCases: number;
  amountAtRiskCents: number;
  activeHolds: number;
  heldCents: number;
  decidedThisWeek: number;
  findingsByWeek: WeeklyFindingPoint[];
  moneyByWeek: WeeklyMoneyPoint[];
  severityByWeek: WeeklySeverityPoint[];
  categorySpend: CategorySpendPoint[];
};

export type AuditEntry = {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  detail: string;
  /** Stamped when the administrator is also the subject. Surfaced in the UI, never hidden. */
  isSelfReview: boolean;
  createdAt: string;
};

export type DecideCaseInput = {
  caseId: string;
  decision: CaseDecision;
  note: string | null;
  actor: { id: string; name: string };
};

export type DecideCaseResult = {
  caseId: string;
  status: CaseStatus;
  /** The new scores so the UI can animate from the old value. */
  subjectScoreBefore: number;
  subjectScoreAfter: number;
  isSelfReview: boolean;
};

export type ReverseHoldInput = {
  holdId: string;
  note: string | null;
  actor: { id: string; name: string };
};

export type ReverseHoldResult = {
  holdId: string;
  releasedAt: string;
  subjectScoreBefore: number;
  subjectScoreAfter: number;
};

/**
 * Every read and write the administrator screens need. Two implementations, selected by
 * AUDITX_DATA. The mutating calls each write their own audit row, so no screen can change
 * something without recording it.
 */
export type AdminRepository = {
  listEmployees(sort?: EmployeeSortKey, direction?: SortDirection): Promise<EmployeeRow[]>;
  getEmployee(employeeId: string): Promise<EmployeeDetail | null>;
  listOpenCases(): Promise<AdminCase[]>;
  getCase(caseId: string): Promise<AdminCase | null>;
  listDocuments(filters: DocumentFilters): Promise<DocumentRow[]>;
  getStats(): Promise<AdminStats>;
  listAudit(limit?: number): Promise<AuditEntry[]>;
  decideCase(input: DecideCaseInput): Promise<DecideCaseResult>;
  reverseHold(input: ReverseHoldInput): Promise<ReverseHoldResult>;
};
