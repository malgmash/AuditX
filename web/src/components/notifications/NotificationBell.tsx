"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  kind: string;
  title: string;
  body: string;
  linkPath: string;
  readAt: string | null;
  createdAt: string;
};

const POLL_MS = 15000;
const SHOWN = 10;

function safePath(path: string): string {
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

function ago(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M6 9a6 6 0 1 1 12 0c0 4.5 1.5 6 2 7H4c.5-1 2-2.5 2-7Z" strokeLinejoin="round" />
      <path d="M10 19a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The header bell. Takes no props, so any layout can mount it as is. It reads the signed-in
 * user's own notifications: a live stream for instant updates, plus a 15 second poll so the
 * unread count is right after any interruption.
 */
export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const root = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications?limit=${SHOWN}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items: Item[]; unread: number };
      setItems(data.items);
      setUnread(data.unread);
      setNow(Date.now());
    } catch {
      // Offline or the server is restarting. The next poll or the stream reconnect tries again.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const poll = setInterval(() => void refresh(), POLL_MS);
    let source: EventSource | null = null;
    if (typeof EventSource !== "undefined") {
      source = new EventSource("/api/notifications/stream");
      source.addEventListener("notification", (event) => {
        const item = JSON.parse((event as MessageEvent<string>).data) as Item;
        setItems((current) => [item, ...current.filter((n) => n.id !== item.id)].slice(0, SHOWN));
        setNow(Date.now());
      });
      source.addEventListener("count", (event) => {
        setUnread((JSON.parse((event as MessageEvent<string>).data) as { unread: number }).unread);
      });
      // The browser reconnects by itself. Refetch when it does, so nothing missed while offline is lost.
      source.addEventListener("open", () => void refresh());
    }
    return () => {
      clearInterval(poll);
      source?.close();
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function post(body: { ids: string[] } | { all: true }) {
    try {
      const res = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) setUnread(((await res.json()) as { unread: number }).unread);
    } catch {
      // Marking read is best effort. The next poll shows the true count.
    }
  }

  async function openItem(item: Item) {
    setOpen(false);
    if (!item.readAt) {
      setItems((current) => current.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)));
      setUnread((count) => Math.max(0, count - 1));
      void post({ ids: [item.id] });
    }
    router.push(safePath(item.linkPath));
  }

  async function markAll() {
    setItems((current) => current.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnread(0);
    await post({ all: true });
  }

  const label = unread > 0 ? `Notifications, ${unread} unread` : "Notifications";

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          setNow(Date.now());
        }}
        className="relative inline-flex size-10 items-center justify-center rounded-control text-ink hover:bg-bone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate"
      >
        <BellIcon />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-0.5 top-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-copper px-1 text-[11px] font-semibold tabular-nums text-bone"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="region"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 w-[360px] max-w-[calc(100vw-2rem)] rounded-card border border-line bg-surface shadow-[0_4px_16px_rgba(23,26,29,0.12)]"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold">Notifications</h2>
            <button
              type="button"
              onClick={() => void markAll()}
              disabled={unread === 0}
              className="text-xs font-semibold text-slate underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-ink-muted disabled:no-underline"
            >
              Mark all as read
            </button>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink-muted">Nothing new. Updates about your reviews and holds appear here.</p>
          ) : (
            <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void openItem(item)}
                    className={cn(
                      "flex w-full gap-3 px-4 py-3 text-left hover:bg-bone focus-visible:bg-bone focus-visible:outline-none",
                      !item.readAt && "bg-copper-tint/40",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.readAt ? "bg-transparent" : "bg-copper")}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={cn("truncate text-sm", item.readAt ? "font-medium" : "font-semibold")}>
                          {item.title}
                          {!item.readAt && <span className="sr-only"> (unread)</span>}
                        </span>
                        <span className="shrink-0 text-xs text-ink-muted">{ago(item.createdAt, now)}</span>
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-ink-muted">{item.body}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
