"use client";

import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ScorePoint } from "@/contracts/employee";

const ScoreSparkline = dynamic(
  () => import("./score-sparkline").then((mod) => mod.ScoreSparkline),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> },
);

export function ScorePanel({ history }: { history: ScorePoint[] }) {
  return (
    <Card>
      <CardContent className="px-6 py-4">
        <ScoreSparkline history={history} />
      </CardContent>
    </Card>
  );
}
