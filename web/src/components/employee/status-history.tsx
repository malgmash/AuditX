import type { StatusChange } from "@/contracts/employee";

const stampFmt = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export function StatusHistory<T extends string>({
  history,
  labelFor,
}: {
  history: StatusChange<T>[];
  labelFor: (status: T) => string;
}) {
  if (history.length === 0) {
    return <p className="text-sm text-ink-muted">No status changes yet.</p>;
  }

  return (
    <ol className="grid gap-2">
      {history.map((change) => (
        <li key={`${change.status}-${change.at}`} className="flex flex-wrap items-baseline gap-2 text-sm">
          <span className="font-semibold">{labelFor(change.status)}</span>
          <span className="text-xs tabular-nums text-ink-muted">{stampFmt.format(new Date(change.at))} UTC</span>
        </li>
      ))}
    </ol>
  );
}
