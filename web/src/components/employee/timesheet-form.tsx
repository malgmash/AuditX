"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LOCATION_CHOICES, locationFromChoice } from "@/lib/employee/locations";
import {
  formatHoursHundredths,
  hoursFromTimes,
  parseHoursHundredths,
} from "@/lib/employee/timesheet-hours";
import {
  defaultLocation,
  mondayOfUtc,
  timesheetFormSchema,
  utcWeekDates,
  weekdayLabel,
} from "@/lib/employee/timesheet-schema";

type DayDraft = {
  startTime: string;
  endTime: string;
  project: string;
  locationChoice: string;
  city: string;
  note: string;
};

function emptyDay(): DayDraft {
  return {
    startTime: "",
    endTime: "",
    project: "Core",
    locationChoice: defaultLocation(),
    city: "",
    note: "",
  };
}

function weekdayDraft(): DayDraft {
  return { ...emptyDay(), startTime: "09:00", endTime: "17:00" };
}

function defaultDays(): DayDraft[] {
  return [0, 1, 2, 3, 4, 5, 6].map((offset) => (offset < 5 ? weekdayDraft() : emptyDay()));
}

export function TimesheetForm() {
  const [weekStart, setWeekStart] = useState(() => mondayOfUtc(new Date()));
  const [days, setDays] = useState<DayDraft[]>(defaultDays);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const dates = utcWeekDates(weekStart);
  const totalHours = useMemo(() => {
    let hundredths = 0;
    for (const day of days) {
      const hours = hoursFromTimes(day.startTime, day.endTime);
      if (!hours) continue;
      const value = parseHoursHundredths(hours);
      if (value !== null) hundredths += value;
    }
    return formatHoursHundredths(hundredths);
  }, [days]);

  function updateDay(index: number, patch: Partial<DayDraft>) {
    setDays((current) => current.map((day, i) => (i === index ? { ...day, ...patch } : day)));
  }

  function onWeekChange(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    setWeekStart(mondayOfUtc(new Date(`${value}T00:00:00.000Z`)));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldError(null);
    const entries = dates.flatMap((workDate, index) => {
      const day = days[index];
      if (!day) return [];
      const blank = !day.startTime && !day.endTime;
      if (blank) return [];
      const hours = hoursFromTimes(day.startTime, day.endTime);
      return [
        {
          workDate,
          startTime: day.startTime,
          endTime: day.endTime,
          hours: hours ?? "",
          project: day.project,
          location: locationFromChoice(day.locationChoice, day.city),
          note: day.note,
        },
      ];
    });
    const parsed = timesheetFormSchema.safeParse({ weekStart, entries });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Check the timesheet fields.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/employee/timesheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setFormError(data.error ?? "We could not submit this timesheet. Try again.");
        return;
      }
      setSubmittedId(data.id);
    } catch {
      setFormError("We could not submit this timesheet. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedId) {
    return (
      <div className="grid gap-4">
        <header>
          <h1 className="font-serif text-3xl font-medium">Timesheet submitted</h1>
          <p className="mt-1 text-xs text-ink-muted">It is on your record with status Submitted.</p>
        </header>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="min-h-10">
            <Link href="/employee">Back to my record</Link>
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="min-h-10"
            onClick={() => {
              setSubmittedId(null);
              setWeekStart(mondayOfUtc(new Date()));
              setDays(defaultDays());
            }}
          >
            Submit another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="font-serif text-3xl font-medium">Submit a timesheet</h1>
        <p className="mt-1 text-xs text-ink-muted">
          One row per day. Say where you were, including remote or another city. Total hours update
          as you type.
        </p>
      </header>

      <Card>
        <CardContent>
          <form className="grid gap-4" noValidate onSubmit={(event) => void onSubmit(event)}>
            <div className="flex flex-col gap-1.5 sm:max-w-xs">
              <Label htmlFor="weekStart">Week starting</Label>
              <Input
                id="weekStart"
                type="date"
                className="min-h-10"
                value={weekStart}
                onChange={(event) => onWeekChange(event.target.value)}
              />
              <p className="text-xs text-ink-muted">The week starts on Monday.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line-strong text-left">
                    <th className="py-2 pr-2 font-semibold">Day</th>
                    <th className="py-2 pr-2 font-semibold">Start</th>
                    <th className="py-2 pr-2 font-semibold">End</th>
                    <th className="py-2 pr-2 text-right font-semibold">Hours</th>
                    <th className="py-2 pr-2 font-semibold">Project</th>
                    <th className="py-2 pr-2 font-semibold">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {dates.map((workDate, index) => {
                    const day = days[index] ?? emptyDay();
                    const hours = hoursFromTimes(day.startTime, day.endTime);
                    const showCity = day.locationChoice === "city";
                    return (
                      <tr key={workDate} className="border-b border-line align-top">
                        <td className="py-2 pr-2">
                          <div className="flex min-h-10 items-center font-semibold">
                            {weekdayLabel(workDate)}
                          </div>
                        </td>
                        <td className="py-2 pr-2">
                          <Input
                            type="time"
                            className="min-h-10"
                            aria-label={`Start time for ${weekdayLabel(workDate)}`}
                            value={day.startTime}
                            onChange={(event) => updateDay(index, { startTime: event.target.value })}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <Input
                            type="time"
                            className="min-h-10"
                            aria-label={`End time for ${weekdayLabel(workDate)}`}
                            value={day.endTime}
                            onChange={(event) => updateDay(index, { endTime: event.target.value })}
                          />
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums">
                          <div className="flex min-h-10 items-center justify-end">
                            {hours ?? (day.startTime || day.endTime ? "—" : "")}
                          </div>
                        </td>
                        <td className="py-2 pr-2">
                          <Input
                            className="min-h-10"
                            aria-label={`Project for ${weekdayLabel(workDate)}`}
                            value={day.project}
                            onChange={(event) => updateDay(index, { project: event.target.value })}
                          />
                        </td>
                        <td className="grid gap-1 py-2">
                          <select
                            className="min-h-10 w-full rounded-control border border-line-strong bg-surface px-3 text-sm text-ink"
                            aria-label={`Location for ${weekdayLabel(workDate)}`}
                            value={day.locationChoice}
                            onChange={(event) =>
                              updateDay(index, { locationChoice: event.target.value })
                            }
                          >
                            {LOCATION_CHOICES.map((choice) => (
                              <option key={choice.value} value={choice.value}>
                                {choice.label}
                              </option>
                            ))}
                          </select>
                          {showCity ? (
                            <Input
                              className="min-h-10"
                              placeholder="City"
                              aria-label={`City for ${weekdayLabel(workDate)}`}
                              value={day.city}
                              onChange={(event) => updateDay(index, { city: event.target.value })}
                            />
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-sm">
              Total hours{" "}
              <span className="font-semibold tabular-nums">{totalHours}</span>
            </p>
            <p className="text-xs text-ink-muted">
              Leave a day blank if you did not work. Remote and another city are stored as you
              enter them.
            </p>

            {fieldError ? (
              <p role="alert" className="text-xs text-error">
                {fieldError}
              </p>
            ) : null}
            {formError ? (
              <p role="alert" className="text-xs text-error">
                {formError}
              </p>
            ) : null}

            <Button type="submit" className="min-h-10 sm:max-w-xs" disabled={submitting}>
              {submitting ? "Submitting" : "Submit timesheet"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
