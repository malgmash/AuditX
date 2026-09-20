import { HttpError } from "@/lib/auth/http";
import type { CreateTimesheetInput, OwnTimesheet } from "@/contracts/employee";
import { resolveActingUserId } from "@/lib/employee/acting-user";
import { getEmployeeRepo } from "@/lib/employee/repo";
import {
  clockToIso,
  timesheetFormSchema,
  workDateToIso,
  type TimesheetFormValues,
} from "@/lib/employee/timesheet-schema";
import type { SessionUser } from "@/lib/auth/session";
import type { EmployeeRepository } from "@/contracts/employee";

export async function submitEmployeeTimesheet(opts: {
  user: SessionUser;
  body: unknown;
  repo?: EmployeeRepository;
}): Promise<OwnTimesheet> {
  const actingUserId = resolveActingUserId(opts.user);
  const parsed = timesheetFormSchema.safeParse(opts.body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Check the timesheet fields.";
    throw new HttpError(422, first);
  }
  return (opts.repo ?? getEmployeeRepo()).createTimesheet(
    actingUserId,
    toCreateInput(parsed.data),
  );
}

export function toCreateInput(values: TimesheetFormValues): CreateTimesheetInput {
  return {
    weekStart: workDateToIso(values.weekStart),
    entries: values.entries.map((entry) => ({
      workDate: workDateToIso(entry.workDate),
      startTime: clockToIso(entry.workDate, entry.startTime),
      endTime: clockToIso(entry.workDate, entry.endTime),
      hours: entry.hours,
      project: entry.project,
      location: entry.location,
      note: entry.note?.trim() ? entry.note.trim() : null,
    })),
  };
}
