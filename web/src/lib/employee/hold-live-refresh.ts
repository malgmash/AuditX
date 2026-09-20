/** Kinds that change the paused-reimbursement list the employee is looking at. */
export function shouldRefreshOnNotificationKind(kind: string): boolean {
  return kind === "HOLD_REVERSED" || kind === "IMMEDIATE_HOLD";
}
