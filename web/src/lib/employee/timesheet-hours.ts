const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function minutesFromClock(value: string): number | null {
  const match = TIME.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Hours to two decimals from a minute count, using integer hundredths. */
export function formatHoursFromMinutes(minutes: number): string {
  if (!Number.isInteger(minutes) || minutes < 0) {
    throw new Error("formatHoursFromMinutes expects a non-negative integer minute count");
  }
  const hundredths = Math.trunc((minutes * 100 + 30) / 60);
  const whole = Math.trunc(hundredths / 100);
  const frac = hundredths % 100;
  return `${whole}.${String(frac).padStart(2, "0")}`;
}

export function hoursFromTimes(startTime: string, endTime: string): string | null {
  const start = minutesFromClock(startTime);
  const end = minutesFromClock(endTime);
  if (start === null || end === null || end <= start) return null;
  return formatHoursFromMinutes(end - start);
}

export function parseHoursHundredths(hours: string): number | null {
  const match = /^(\d+)\.(\d{2})$/.exec(hours);
  if (!match) return null;
  return Number(match[1]) * 100 + Number(match[2]);
}

export function formatHoursHundredths(hundredths: number): string {
  if (!Number.isInteger(hundredths) || hundredths < 0) {
    throw new Error("formatHoursHundredths expects a non-negative integer");
  }
  const whole = Math.trunc(hundredths / 100);
  const frac = hundredths % 100;
  return `${whole}.${String(frac).padStart(2, "0")}`;
}

export function hoursMatchTimes(startTime: string, endTime: string, hours: string): boolean {
  return hoursFromTimes(startTime, endTime) === hours;
}
