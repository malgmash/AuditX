// Types the employee UI reads and writes. Owned by the employee stream.

export type ExpenseStatus = "SUBMITTED" | "APPROVED" | "HELD" | "DECLINED" | "REIMBURSED";
export type TimesheetStatus = "SUBMITTED" | "APPROVED" | "DECLINED";
export type FindingSeverity = "IMMEDIATE_HOLD" | "CASE" | "NOTE";
export type FindingReviewStatus = "PENDING_REVIEW" | "NO_ACTION" | "CONFIRMED";
export type ExtractionFieldName = "merchantName" | "transactionDate" | "totalCents";

export type ExtractedField<T> = {
  value: T;
  /** Rule or model confidence in 0 to 1. */
  confidence: number;
};

export type ExpenseExtraction = {
  merchantName: ExtractedField<string>;
  transactionDate: ExtractedField<string>;
  totalCents: ExtractedField<number>;
  merchantCity: ExtractedField<string> | null;
  transactionTime: ExtractedField<string | null> | null;
  legibility: number;
  /** Fields the employee changed after extraction prefilled them. */
  correctedFields: ExtractionFieldName[];
};

export type OwnReceipt = {
  id: string;
  storageKey: string;
  mimeType: string;
  sha256: string;
  /** 256-bit hex. Mocked until analysis delivers perceptual hashing. */
  phash?: string;
};

export type StatusChange<T extends string> = {
  status: T;
  at: string;
};

export type OwnExpense = {
  id: string;
  userId: string;
  submittedAt: string;
  incurredAt: string;
  merchantRaw: string;
  categoryId: string;
  amountCents: number;
  currency: "USD";
  description: string;
  receipt: OwnReceipt | null;
  status: ExpenseStatus;
  statusHistory: StatusChange<ExpenseStatus>[];
  extraction: ExpenseExtraction | null;
};

export type OwnTimesheetEntry = {
  id: string;
  workDate: string;
  startTime: string | null;
  endTime: string | null;
  /** Hours to two decimal places, stored as a string so money-path floats never leak in. */
  hours: string;
  project: string | null;
  /** Office location name, "remote", or a free-text city. */
  location: string | null;
  note: string | null;
};

export type OwnTimesheet = {
  id: string;
  userId: string;
  weekStart: string;
  submittedAt: string;
  status: TimesheetStatus;
  statusHistory: StatusChange<TimesheetStatus>[];
  entries: OwnTimesheetEntry[];
};

export type ScorePoint = {
  asOf: string;
  value: number;
};

export type OwnScoreEvent = {
  id: string;
  findingId: string | null;
  delta: number;
  reason: string;
  createdAt: string;
};

export type OwnScore = {
  userId: string;
  value: number;
  asOf: string;
  history: ScorePoint[];
  events: OwnScoreEvent[];
};

export type OwnFinding = {
  id: string;
  userId: string;
  ruleId: string;
  expenseIds: string[];
  timesheetIds: string[];
  amountAtRiskCents: number;
  severity: FindingSeverity;
  detectedAt: string;
  incurredOn: string;
  reason: string;
  nextStep: string;
  reviewStatus: FindingReviewStatus;
};

export type OwnHold = {
  id: string;
  expenseId: string;
  findingId: string;
  placedAt: string;
  releasedAt: string | null;
  reason: string;
  nextStep: string;
};

export type EmployeeOverview = {
  userId: string;
  name: string;
  department: string;
  score: OwnScore;
  holds: OwnHold[];
};

export type CreateExpenseInput = {
  incurredAt: string;
  merchantRaw: string;
  categoryId: string;
  amountCents: number;
  description: string;
  receipt: OwnReceipt | null;
  extraction: ExpenseExtraction | null;
};

export type CreateTimesheetInput = {
  weekStart: string;
  entries: Array<Omit<OwnTimesheetEntry, "id">>;
};

export type EmployeeRepository = {
  getOverview(userId: string): Promise<EmployeeOverview | null>;
  getScore(userId: string): Promise<OwnScore | null>;
  listExpenses(userId: string): Promise<OwnExpense[]>;
  getExpense(userId: string, expenseId: string): Promise<OwnExpense | null>;
  listTimesheets(userId: string): Promise<OwnTimesheet[]>;
  getTimesheet(userId: string, timesheetId: string): Promise<OwnTimesheet | null>;
  listFindings(userId: string): Promise<OwnFinding[]>;
  getFinding(userId: string, findingId: string): Promise<OwnFinding | null>;
  listHolds(userId: string): Promise<OwnHold[]>;
  createExpense(userId: string, input: CreateExpenseInput): Promise<OwnExpense>;
  createTimesheet(userId: string, input: CreateTimesheetInput): Promise<OwnTimesheet>;
};
