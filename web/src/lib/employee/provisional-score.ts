import type { ScorePoint } from "@/contracts/employee";

/**
 * A stand-in for the analysis service's scoring engine, used only while no Score rows exist. It
 * follows the formulas in SYSTEM-DESIGN.md for pending findings: penalty = points x 0.35 x
 * decay(age), decay = 0.5 ** (months / 6), and the pending total is capped at 15 points. When the
 * analysis service writes real Score rows, the repo reads those and this is never called.
 */
export type PenaltyInput = {
  findingId: string;
  /** base_points x confidence, as stored on the finding. */
  points: number;
  occurredAt: string;
  reason: string;
};

export const PENDING_FACTOR = 0.35;
export const PENDING_CAP = 15;
const HISTORY_MONTHS = 6;

function monthsBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / (30.4375 * 24 * 3600 * 1000));
}

function penaltyAt(p: PenaltyInput, asOf: Date): number {
  const occurred = new Date(p.occurredAt);
  if (occurred.getTime() > asOf.getTime()) return 0;
  return p.points * PENDING_FACTOR * 0.5 ** (monthsBetween(occurred, asOf) / 6);
}

function scoreAt(penalties: PenaltyInput[], asOf: Date): number {
  const total = penalties.reduce((sum, p) => sum + penaltyAt(p, asOf), 0);
  return Math.round(Math.min(100, Math.max(0, 100 - Math.min(PENDING_CAP, total))));
}

function endOfMonthUtc(year: number, month: number): Date {
  return new Date(Date.UTC(year, month + 1, 1) - 1);
}

export function provisionalScore(penalties: PenaltyInput[], now: Date) {
  const history: ScorePoint[] = [];
  for (let back = HISTORY_MONTHS - 1; back >= 0; back--) {
    const ref = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const end = back === 0 ? now : endOfMonthUtc(ref.getUTCFullYear(), ref.getUTCMonth());
    history.push({ asOf: end.toISOString(), value: scoreAt(penalties, end) });
  }
  const events = penalties
    .filter((p) => p.points > 0)
    .map((p) => ({
      findingId: p.findingId,
      delta: -Math.round(penaltyAt(p, now) * 10) / 10,
      reason: p.reason,
      at: p.occurredAt,
    }));
  return { value: scoreAt(penalties, now), asOf: now.toISOString(), history, events };
}
