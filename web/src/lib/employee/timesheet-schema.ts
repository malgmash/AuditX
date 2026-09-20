import { z } from "zod";
import { OFFICE_LOCATION, REMOTE_LOCATION } from "@/lib/employee/locations";
import { hoursMatchTimes } from "@/lib/employee/timesheet-hours";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;
const HOURS = /^\d+\.\d{2}$/;

export const timesheetEntrySchema = z
  .object({
    workDate: z.string().regex(ISO_DAY, "Enter a work date."),
    startTime: z.string().regex(CLOCK, "Enter a start time."),
    endTime: z.string().regex(CLOCK, "Enter an end time."),
    hours: z.string().regex(HOURS, "Hours must have two decimal places, for example 8.00."),
    project: z.string().trim().min(1, "Enter a project.").max(80),
    location: z.string().trim().min(1, "Say where you were that day.").max(80),
    note: z.string().trim().max(200).optional(),
  })
  .superRefine((entry, ctx) => {
    if (!hoursMatchTimes(entry.startTime, entry.endTime, entry.hours)) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "End time must be after start time, and hours must match those times.",
      });
    }
  });

export const timesheetFormSchema = z
  .object({
    weekStart: z.string().regex(ISO_DAY, "Enter the Monday that starts this week."),
    entries: z.array(timesheetEntrySchema).min(1, "Add at least one day with start and end times."),
  })
  .superRefine((value, ctx) => {
    if (!isUtcMonday(value.weekStart)) {
      ctx.addIssue({
        code: "custom",
        path: ["weekStart"],
        message: "The week must start on a Monday.",
      });
    }
    const weekDays = new Set(utcWeekDates(value.weekStart));
    const seen = new Set<string>();
    for (const [index, entry] of value.entries.entries()) {
      if (!weekDays.has(entry.workDate)) {
        ctx.addIssue({
          code: "custom",
          path: ["entries", index, "workDate"],
          message: "Each day must fall in the selected week.",
        });
      }
      if (seen.has(entry.workDate)) {
        ctx.addIssue({
          code: "custom",
          path: ["entries", index, "workDate"],
          message: "Each date can appear only once.",
        });
      }
      seen.add(entry.workDate);
    }
  });

export type TimesheetFormValues = z.infer<typeof timesheetFormSchema>;
export type TimesheetEntryValues = z.infer<typeof timesheetEntrySchema>;

export function isUtcMonday(isoDay: string): boolean {
  if (!ISO_DAY.test(isoDay)) return false;
  return new Date(`${isoDay}T00:00:00.000Z`).getUTCDay() === 1;
}

export function mondayOfUtc(date: Date): string {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = copy.getUTCDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  copy.setUTCDate(copy.getUTCDate() + offset);
  return copy.toISOString().slice(0, 10);
}

export function addUtcDays(isoDay: string, days: number): string {
  const date = new Date(`${isoDay}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function utcWeekDates(weekStart: string): string[] {
  return [0, 1, 2, 3, 4, 5, 6].map((offset) => addUtcDays(weekStart, offset));
}

export function weekdayLabel(isoDay: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDay}T00:00:00.000Z`));
}

export function workDateToIso(isoDay: string): string {
  return `${isoDay}T00:00:00.000Z`;
}

export function clockToIso(isoDay: string, clock: string): string {
  return `${isoDay}T${clock}:00.000Z`;
}

export function defaultLocation(): string {
  return OFFICE_LOCATION;
}

export { OFFICE_LOCATION, REMOTE_LOCATION };
