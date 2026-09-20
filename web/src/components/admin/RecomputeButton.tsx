"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Admin-only, and it asks first: it re-runs every detector and rescores everyone. */
export function RecomputeButton() {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "confirm" | "running">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function run() {
    setStep("running");
    setMessage(null);
    setFailed(false);
    try {
      const res = await fetch("/api/admin/recompute", { method: "POST" });
      const payload: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const text =
          typeof payload === "object" && payload !== null && "error" in payload
            ? String((payload as { error: unknown }).error)
            : "Recompute did not run.";
        setFailed(true);
        setMessage(text);
      } else {
        setMessage("Scores and flags were rebuilt.");
        router.refresh();
      }
    } catch {
      setFailed(true);
      setMessage("Recompute did not run. Nothing was changed. Try again in a moment.");
    } finally {
      setStep("idle");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {step === "confirm" ? (
        <div role="group" aria-label="Confirm recompute" className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-xs text-ink-muted">This re-runs every check and rescores everyone.</span>
          <Button type="button" size="sm" onClick={() => void run()}>
            Recompute
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => setStep("idle")}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button type="button" size="sm" variant="secondary" disabled={step === "running"} onClick={() => setStep("confirm")}>
          {step === "running" ? "Recomputing" : "Recompute scores"}
        </Button>
      )}
      {message ? (
        <p role={failed ? "alert" : "status"} className={`text-xs ${failed ? "text-error" : "text-sage-text"}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
