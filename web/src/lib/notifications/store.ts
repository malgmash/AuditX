import { db } from "@/lib/db";

export type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string;
  linkPath: string;
  readAt: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  kind: string;
  title: string;
  body: string;
  linkPath: string;
  readAt: Date | null;
  createdAt: Date;
};

function toItem(row: Row): NotificationItem {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    linkPath: row.linkPath,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

// Every query below filters by userId at the database layer. A notification id from another
// user never matches, so there is nothing to leak by editing a request.

export async function listNotifications(
  userId: string,
  opts: { limit?: number; before?: string } = {},
): Promise<{ items: NotificationItem[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 50);
  const before = opts.before ? new Date(opts.before) : null;
  const rows = await db.notification.findMany({
    where: { userId, ...(before && !Number.isNaN(before.getTime()) ? { createdAt: { lt: before } } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map(toItem),
    nextCursor: rows.length > limit ? page[page.length - 1]!.createdAt.toISOString() : null,
  };
}

export function unreadCount(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } });
}

export async function markRead(userId: string, target: { ids: string[] } | { all: true }): Promise<number> {
  const where =
    "all" in target ? { userId, readAt: null } : { userId, readAt: null, id: { in: target.ids } };
  const result = await db.notification.updateMany({ where, data: { readAt: new Date() } });
  return result.count;
}

/** Notifications for this user created after `since`, oldest first. Used by the live stream. */
export async function createdSince(userId: string, since: Date): Promise<NotificationItem[]> {
  const rows = await db.notification.findMany({
    where: { userId, createdAt: { gt: since } },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  return rows.map(toItem);
}
