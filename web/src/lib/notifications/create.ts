import { db } from "@/lib/db";

export type NotificationKind = "IMMEDIATE_HOLD" | "NEW_CASE" | "CASE_DECIDED" | "HOLD_REVERSED";

/**
 * Write one notification row for one recipient. Callers choose the recipient. To notify every
 * administrator, call once per admin. The real-time stream and bell read this table.
 */
export async function createNotification(n: {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  linkPath: string;
}): Promise<void> {
  await db.notification.create({ data: { ...n, createdAt: new Date() } });
}
