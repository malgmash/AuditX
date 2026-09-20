import { describe, expect, it } from "vitest";
import { shouldRefreshOnNotificationKind } from "@/lib/employee/hold-live-refresh";

describe("shouldRefreshOnNotificationKind", () => {
  it("refreshes when a hold is reversed or placed", () => {
    expect(shouldRefreshOnNotificationKind("HOLD_REVERSED")).toBe(true);
    expect(shouldRefreshOnNotificationKind("IMMEDIATE_HOLD")).toBe(true);
  });

  it("leaves the page alone for kinds that do not change the paused list", () => {
    expect(shouldRefreshOnNotificationKind("NEW_CASE")).toBe(false);
    expect(shouldRefreshOnNotificationKind("CASE_DECIDED")).toBe(false);
    expect(shouldRefreshOnNotificationKind("")).toBe(false);
  });
});
