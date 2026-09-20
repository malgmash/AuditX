import { withUser } from "@/lib/auth/with-role";
import { createdSince, unreadCount } from "@/lib/notifications/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLL_MS = 3000;
const HEARTBEAT_MS = 15000;
const OVERLAP_MS = 5000;

/**
 * GET /api/notifications/stream. Server-Sent Events for the signed-in user only. The connection
 * checks the database every few seconds for new rows, which works through the connection pooler
 * (LISTEN/NOTIFY does not). The client keeps a 15 second polling fallback, so a dropped stream
 * never leaves the badge wrong.
 */
export const GET = withUser(async (req, { user }) => {
  const encoder = new TextEncoder();
  const seen = new Set<string>();
  let since = new Date(Date.now() - OVERLAP_MS);
  let timers: ReturnType<typeof setInterval>[] = [];
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (!closed) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        timers.forEach(clearInterval);
        timers = [];
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      req.signal.addEventListener("abort", close);
      send("count", { unread: await unreadCount(user.id) });

      const tick = async () => {
        if (closed) return;
        try {
          const fresh = (await createdSince(user.id, since)).filter((n) => !seen.has(n.id));
          if (fresh.length === 0) return;
          for (const n of fresh) {
            seen.add(n.id);
            send("notification", n);
          }
          since = new Date(new Date(fresh[fresh.length - 1]!.createdAt).getTime() - OVERLAP_MS);
          send("count", { unread: await unreadCount(user.id) });
        } catch {
          // A failed poll is retried on the next tick. The client's own polling covers the gap.
        }
      };

      timers.push(setInterval(tick, POLL_MS));
      timers.push(
        setInterval(() => {
          if (!closed) controller.enqueue(encoder.encode(": ping\n\n"));
        }, HEARTBEAT_MS),
      );
    },
    cancel() {
      closed = true;
      timers.forEach(clearInterval);
      timers = [];
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
