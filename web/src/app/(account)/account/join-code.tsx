"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** The organisation's join code, with a copy button. Administrators share this with new employees. */
export function JoinCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard permission denied or unavailable; the code is still selectable text */
    }
  }

  return (
    <div className="flex items-center gap-2">
      <code className="rounded-control border border-line bg-bone px-3 py-1.5 text-sm font-semibold tracking-[0.08em]">
        {code}
      </code>
      <Button type="button" variant="secondary" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
