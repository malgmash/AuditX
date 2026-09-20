import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SHOW_SCORE_NUMBER } from "@/lib/employee/config";
import type { RecordScoreChange } from "@/lib/employee/record";

const dayFmt = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function ScoreChanges({
  score,
  changes,
}: {
  score: number;
  changes: RecordScoreChange[];
}) {
  return (
    <section aria-labelledby="score-changes-heading" className="grid gap-4">
      <h2 id="score-changes-heading" className="font-serif text-xl font-medium">
        Why your score changed
      </h2>
      <Card>
        {SHOW_SCORE_NUMBER ? (
          <CardHeader className="px-6">
            <CardTitle>Score now</CardTitle>
            <p className="text-3xl font-semibold tabular-nums">{score}</p>
          </CardHeader>
        ) : null}
        <CardContent>
          {changes.length === 0 ? (
            <p className="max-w-[72ch] text-sm text-ink-muted">
              Your score has not changed. Anything that changes it will be listed here with the reason.
            </p>
          ) : (
            <Table>
              <TableCaption>Newest change first. Each line says what moved the score.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changes.map((change) => (
                  <TableRow key={change.id}>
                    <TableCell className="tabular-nums text-ink-muted">
                      {dayFmt.format(new Date(change.createdAt))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{change.deltaLabel}</TableCell>
                    <TableCell className="whitespace-normal">{change.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
