"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { ScorePoint } from "@/contracts/employee";

const ScoreSparkline = dynamic(
  () => import("./score-sparkline").then((mod) => mod.ScoreSparkline),
  { ssr: false, loading: () => <Skeleton className="h-32 w-full" /> },
);

export function ScorePanel({
  value,
  history,
  showNumber,
}: {
  value: number;
  history: ScorePoint[];
  showNumber: boolean;
}) {
  return (
    <section
      aria-labelledby="score-heading"
      className="rounded-card border border-line bg-surface p-6"
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] md:items-end md:gap-8">
        <div>
          <h2 id="score-heading" className="font-serif text-xl font-medium leading-7">
            Current score
          </h2>
          {showNumber ? (
            <p className="mt-3 text-3xl font-semibold tabular-nums leading-9">{value}</p>
          ) : (
            <p className="mt-3 text-sm text-ink-muted">Hidden</p>
          )}
        </div>
        <ScoreSparkline history={history} />
      </div>
    </section>
  );
}
