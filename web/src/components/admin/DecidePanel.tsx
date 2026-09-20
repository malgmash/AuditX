"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CaseDecision, DecideCaseResult } from "@/contracts/admin";

/**
 * The score counting from its old value to its new one. The single expressive animation in the
 * design: 600ms, and an instant change when the viewer asks for reduced motion.
 */
function useCountTo(target: number | null, from: number | null) {
  const [value, setValue] = useState(from);
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (target === null || from === null) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setValue(target);
      return;
    }

    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 600);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round((from + (target - from) * eased) * 10) / 10);
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);

    return () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    };
  }, [target, from]);

  return value;
}

export function DecidePanel({
  caseId,
  subjectName,
  hasHold,
  heldLabel,
}: {
  caseId: string;
  subjectName: string;
  hasHold: boolean;
  heldLabel: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<CaseDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DecideCaseResult | null>(null);

  const score = useCountTo(result?.subjectScoreAfter ?? null, result?.subjectScoreBefore ?? null);

  async function decide(decision: CaseDecision) {
    setPending(decision);
    setError(null);
    try {
      const res = await fetch(`/api/admin/cases/${caseId}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: note.trim() || undefined }),
      });
      const payload: unknown = await res.json();
      if (!res.ok) {
        const message =
          typeof payload === "object" && payload !== null && "error" in payload
            ? String((payload as { error: unknown }).error)
            : "The decision was not saved.";
        setError(`${message} Nothing was recorded. You can try again.`);
        return;
      }
      setResult(payload as DecideCaseResult);
    } catch {
      setError("The decision could not be sent. Check your connection and try again.");
    } finally {
      setPending(null);
    }
  }

  if (result) {
    const accepted = result.status === "ACCEPTED";
    return (
      <div
        className={`mt-4 max-w-[68ch] rounded-card border border-line border-l-2 p-4 ${
          accepted ? "border-l-copper" : "border-l-sage"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">{accepted ? "Accepted" : "Declined"}</h3>
          {result.isSelfReview ? <Badge variant="held">Own record</Badge> : null}
          {score !== null ? (
            <span className="ml-auto text-2xl font-semibold tabular-nums">{score}</span>
          ) : null}
        </div>

        <p className="mt-1 text-xs text-ink-muted">
          {accepted
            ? `Recorded as needing a next step.${hasHold ? ` ${heldLabel} stays held.` : ""}`
            : `No action taken.${hasHold ? ` ${heldLabel} has been released and will be reimbursed.` : ""} The finding stays on the record as a label, and the points are restored.`}{" "}
          {subjectName} has been notified. An audit entry was written.
        </p>

        <div className="mt-4">
          <Button type="button" variant="secondary" size="sm" onClick={() => router.refresh()}>
            Next case
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 border-t border-line pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => decide("ACCEPTED")} disabled={pending !== null}>
          {pending === "ACCEPTED" ? "Saving" : "Accept"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => decide("DECLINED")}
          disabled={pending !== null}
        >
          {pending === "DECLINED" ? "Saving" : "Decline"}
        </Button>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="Add a note (optional)"
          aria-label="Decision note"
          className="min-w-[200px] flex-1"
        />
      </div>

      <p className="mt-2 text-xs text-ink-muted">
        Accepting records that the pattern needs a next step. It is not a finding about the person.
      </p>

      {error ? (
        <p role="alert" className="mt-2 text-xs text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
