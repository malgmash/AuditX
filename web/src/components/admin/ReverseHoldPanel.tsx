"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ReverseHoldResult } from "@/contracts/admin";
import { useCountTo } from "@/components/admin/useCountTo";

export type HoldItem = { id: string; amountLabel: string; since: string };

/**
 * Releasing a hold is one click, at least as easy as placing one. The note is optional and
 * shared, so it never stands between the reviewer and the button. The result names the score
 * before and after, counting from one to the other.
 */
export function ReverseHoldPanel({ holds, subjectName }: { holds: HoldItem[]; subjectName: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, ReverseHoldResult>>({});

  const last = Object.values(done).at(-1) ?? null;
  const score = useCountTo(last?.subjectScoreAfter ?? null, last?.subjectScoreBefore ?? null);

  if (holds.length === 0) return null;

  async function release(id: string) {
    setPending(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/holds/${id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      const payload: unknown = await res.json();
      if (!res.ok) {
        const message =
          typeof payload === "object" && payload !== null && "error" in payload
            ? String((payload as { error: unknown }).error)
            : "The hold was not released.";
        setError(`${message} Nothing was changed.`);
        return;
      }
      // No refresh here: releasing closes the case, so refreshing would take this panel, and the
      // score moving from one number to the other, off the screen. "Continue" refreshes.
      setDone((current) => ({ ...current, [id]: payload as ReverseHoldResult }));
    } catch {
      setError("The hold was not released. Nothing was changed. Try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section aria-labelledby="holds-heading" className="mt-6 rounded-card border border-copper bg-copper-tint p-4">
      <h3 id="holds-heading" className="font-serif text-xl font-medium">
        Paused reimbursements
      </h3>
      <p className="mt-1 max-w-[68ch] text-sm">
        These are paused for {subjectName} until a reviewer decides. Releasing one puts the points back on the score and tells
        them. It can be done at any time.
      </p>
      <ul className="mt-3">
        {holds.map((hold) => {
          const result = done[hold.id];
          return (
            <li key={hold.id} className="flex flex-wrap items-center gap-3 border-t border-line py-2">
              <span className="min-w-0 flex-1 text-sm">
                <span className="font-semibold tabular-nums">{hold.amountLabel}</span> paused since {hold.since}
              </span>
              {result ? (
                <span role="status" className="text-sm font-semibold text-sage-text">
                  Released
                </span>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending !== null}
                  onClick={() => void release(hold.id)}
                >
                  {pending === hold.id ? "Releasing" : "Release hold"}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex max-w-[420px] flex-col gap-1">
        <label htmlFor="release-note" className="text-xs font-semibold text-ink-muted">
          Note (optional)
        </label>
        <Input id="release-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-error">
          {error}
        </p>
      ) : null}
      {last && score !== null ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p role="status" className="text-sm">
            Released. Score for {subjectName}: <span className="tabular-nums">{last.subjectScoreBefore.toFixed(1)}</span> to{" "}
            <span className="font-semibold tabular-nums">{score.toFixed(1)}</span>. They have been told.
          </p>
          <Button type="button" size="sm" onClick={() => router.refresh()}>
            Continue to the next case
          </Button>
        </div>
      ) : null}
    </section>
  );
}
