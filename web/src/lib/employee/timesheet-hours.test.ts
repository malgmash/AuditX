import { describe, expect, it } from "vitest";
import { hoursFromTimes, hoursMatchTimes, parseHoursHundredths } from "./timesheet-hours";
import { isUtcMonday, mondayOfUtc, utcWeekDates } from "./timesheet-schema";

describe("hoursFromTimes", () => {
  it("computes 8.00 from 09:00 to 17:00", () => {
    expect(hoursFromTimes("09:00", "17:00")).toBe("8.00");
  });

  it("computes 7.50 from 09:00 to 16:30", () => {
    expect(hoursFromTimes("09:00", "16:30")).toBe("7.50");
  });

  it("rejects an end time that is not after start", () => {
    expect(hoursFromTimes("17:00", "09:00")).toBeNull();
    expect(hoursFromTimes("09:00", "09:00")).toBeNull();
    expect(hoursMatchTimes("09:00", "17:00", "7.00")).toBe(false);
  });
});

describe("week start", () => {
  it("treats 2026-09-14 as a Monday", () => {
    expect(isUtcMonday("2026-09-14")).toBe(true);
    expect(isUtcMonday("2026-09-15")).toBe(false);
  });

  it("snaps a Sunday to the preceding Monday", () => {
    expect(mondayOfUtc(new Date("2026-09-20T16:00:00.000Z"))).toBe("2026-09-14");
  });

  it("lists seven dates from week start", () => {
    expect(utcWeekDates("2026-09-14")).toEqual([
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
      "2026-09-20",
    ]);
  });
});

describe("parseHoursHundredths", () => {
  it("sums two decimal hours as integer hundredths", () => {
    expect(parseHoursHundredths("8.00")).toBe(800);
    expect(parseHoursHundredths("7.50")).toBe(750);
  });
});
