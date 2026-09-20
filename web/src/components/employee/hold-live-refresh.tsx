"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { shouldRefreshOnNotificationKind } from "@/lib/employee/hold-live-refresh";

/**
 * The overview is a server component. The bell updates its own list from the stream, but does
 * not refresh the page, so a reversed hold would stay on screen until the next navigation.
 * This listens for the same stream and refreshes when a hold is placed or released.
 */
export function HoldLiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const source = new EventSource("/api/notifications/stream");
    source.addEventListener("notification", (event) => {
      try {
        const item = JSON.parse((event as MessageEvent<string>).data) as { kind?: string };
        if (typeof item.kind === "string" && shouldRefreshOnNotificationKind(item.kind)) {
          router.refresh();
        }
      } catch {
        // A malformed event is ignored; the next one still arrives.
      }
    });
    return () => source.close();
  }, [router]);

  return null;
}
