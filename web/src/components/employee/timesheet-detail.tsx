import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusHistory } from "@/components/employee/status-history";
import type { OwnTimesheet } from "@/contracts/employee";
import { REMOTE_LOCATION } from "@/lib/employee/locations";
import {
  timesheetStatusBadgeVariant,
  timesheetStatusLabel,
  totalTimesheetHours,
  weekLabel,
} from "@/lib/employee/submissions";

const dayFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const clockFmt = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

function clock(value: string | null): string {
  return value ? clockFmt.format(new Date(value)) : "Not given";
}

function locationLabel(value: string | null): string {
  if (!value) return "Not given";
  return value === REMOTE_LOCATION ? "Remote" : value;
}

export function TimesheetDetailView({ timesheet }: { timesheet: OwnTimesheet }) {
  const total = totalTimesheetHours(timesheet.entries);

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{weekLabel(timesheet.weekStart)}</CardTitle>
            <Badge variant={timesheetStatusBadgeVariant(timesheet.status)}>
              {timesheetStatusLabel(timesheet.status)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div>
            <p className="text-xs text-ink-muted">Total hours</p>
            <p className="text-3xl font-semibold tabular-nums">{total}</p>
          </div>
          <Table>
            <TableCaption>Times are shown in UTC, as they were submitted.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Where you were</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timesheet.entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="tabular-nums">{dayFmt.format(new Date(entry.workDate))}</TableCell>
                  <TableCell className="tabular-nums text-ink-muted">{clock(entry.startTime)}</TableCell>
                  <TableCell className="tabular-nums text-ink-muted">{clock(entry.endTime)}</TableCell>
                  <TableCell className="text-right tabular-nums">{entry.hours}</TableCell>
                  <TableCell>{entry.project ?? "Not given"}</TableCell>
                  <TableCell>{locationLabel(entry.location)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-6">
          <CardTitle>Status history</CardTitle>
        </CardHeader>
        <CardContent>
          <StatusHistory history={timesheet.statusHistory} labelFor={timesheetStatusLabel} />
        </CardContent>
      </Card>
    </div>
  );
}
