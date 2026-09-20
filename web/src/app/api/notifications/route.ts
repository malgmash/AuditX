import { NextResponse } from "next/server";
import { withUser } from "@/lib/auth/with-role";
import { listNotifications, unreadCount } from "@/lib/notifications/store";

export const dynamic = "force-dynamic";

/** GET /api/notifications?limit=10&before=<ISO>. Only the signed-in user's own notifications. */
export const GET = withUser(async (req, { user }) => {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? "10");
  const before = url.searchParams.get("before") ?? undefined;
  const [page, unread] = await Promise.all([
    listNotifications(user.id, { limit: Number.isFinite(limit) ? limit : 10, before }),
    unreadCount(user.id),
  ]);
  return NextResponse.json({ ...page, unread });
});
