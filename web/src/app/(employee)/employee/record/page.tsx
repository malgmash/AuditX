import { Suspense } from "react";
import { redirect } from "next/navigation";
import { FindingsPanel } from "@/components/employee/findings-panel";
import { ScoreChanges } from "@/components/employee/score-changes";
import { ScorePanel } from "@/components/employee/score-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveActingUserId } from "@/lib/employee/acting-user";
import { buildRecordFindings, buildScoreChanges } from "@/lib/employee/record";
import { getEmployeeRepo } from "@/lib/employee/repo";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = { title: "Findings and score" };

async function RecordBody() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const repo = getEmployeeRepo();
  const actingId = resolveActingUserId(user);
  let findings;
  let score;
  try {
    [findings, score] = await Promise.all([repo.listFindings(actingId), repo.getScore(actingId)]);
  } catch {
    return (
      <p className="max-w-[72ch] text-sm text-ink-muted">
        We could not load your record. Sign in again, or try once more in a moment.
      </p>
    );
  }

  if (!score) {
    return (
      <p className="max-w-[72ch] text-sm text-ink-muted">
        There is no record for this account yet. It appears once you have submitted something.
      </p>
    );
  }

  return (
    <div className="grid gap-6">
      <FindingsPanel findings={buildRecordFindings(findings)} />
      <ScoreChanges score={score.value} changes={buildScoreChanges(score.events)} />
      <section aria-labelledby="score-history-heading" className="grid gap-4">
        <h2 id="score-history-heading" className="font-serif text-xl font-medium">
          Your score over six months
        </h2>
        <ScorePanel history={score.history} />
      </section>
    </div>
  );
}

function RecordSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

export default function EmployeeRecordPage() {
  return (
    <div className="grid max-w-5xl gap-6">
      <header className="grid gap-1">
        <h1 className="font-serif text-3xl font-medium">Findings and score</h1>
        <p className="text-xs text-ink-muted">
          Everything flagged on your record, in plain words, and what moved your score.
        </p>
      </header>

      <Suspense fallback={<RecordSkeleton />}>
        <RecordBody />
      </Suspense>
    </div>
  );
}
