import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError } from "@/lib/auth/http";
import { withUser } from "@/lib/auth/with-role";
import { markRead, unreadCount } from "@/lib/notifications/store";

export const dynamic = "force-dynamic";

const body = z.union([
  z.object({ ids: z.array(z.string().min(1).max(64)).min(1).max(100) }).strict(),
  z.object({ all: z.literal(true) }).strict(),
]);

/** POST /api/notifications/read with { ids: [...] } or { all: true }. Marks the user's own rows read. */
export const POST = withUser(async (req, { user }) => {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(422, "Send { ids: [...] } or { all: true }");
  const marked = await markRead(user.id, parsed.data);
  return NextResponse.json({ marked, unread: await unreadCount(user.id) });
});
