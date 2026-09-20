import { describe, expect, it } from "vitest";
import { decideRouteAccess } from "./route-guard";

const employee = { signedIn: true, role: "EMPLOYEE" as const };
const admin = { signedIn: true, role: "ADMIN" as const };

const adminApiPaths = [
  "/api/admin",
  "/api/admin/employees",
  "/api/admin/employees/user_other",
  "/api/admin/cases",
  "/api/admin/cases/case_1",
  "/api/admin/cases/case_1/decide",
  "/api/admin/holds/hold_1/reverse",
  "/api/admin/stats",
  "/api/admin/documents",
  "/api/admin/cases/case_1/ask",
  "/api/admin/policies",
];

describe("decideRouteAccess", () => {
  it("lets anyone use login, register and Auth.js routes", () => {
    for (const pathname of ["/login", "/register", "/register/employee", "/api/auth/callback/credentials"]) {
      expect(decideRouteAccess({ pathname, signedIn: false })).toEqual({ type: "next" });
    }
  });

  it("sends a signed-in employee away from /login and /register to /employee", () => {
    expect(decideRouteAccess({ pathname: "/login", ...employee })).toEqual({
      type: "redirect",
      to: "/employee",
    });
    expect(decideRouteAccess({ pathname: "/register/organization", ...employee })).toEqual({
      type: "redirect",
      to: "/employee",
    });
  });

  it("redirects unauthenticated page requests to login and keeps the original path", () => {
    expect(decideRouteAccess({ pathname: "/employee", search: "?tab=held", signedIn: false })).toEqual({
      type: "redirect",
      to: "/login?callbackUrl=%2Femployee%3Ftab%3Dheld",
    });
    expect(decideRouteAccess({ pathname: "/admin", signedIn: false })).toEqual({
      type: "redirect",
      to: "/login?callbackUrl=%2Fadmin",
    });
  });

  it("returns 401 JSON for unauthenticated API requests", () => {
    expect(decideRouteAccess({ pathname: "/api/employee/expenses", signedIn: false })).toEqual({
      type: "json",
      status: 401,
      error: "Sign in required",
    });
    expect(decideRouteAccess({ pathname: "/api/admin/stats", signedIn: false })).toEqual({
      type: "json",
      status: 401,
      error: "Sign in required",
    });
  });

  it("redirects an employee away from /admin and every nested admin page", () => {
    expect(decideRouteAccess({ pathname: "/admin", ...employee })).toEqual({
      type: "redirect",
      to: "/employee",
    });
    expect(decideRouteAccess({ pathname: "/admin/cases/case_1", ...employee })).toEqual({
      type: "redirect",
      to: "/employee",
    });
  });

  it("returns 403 for an employee on every /api/admin path, including the prefix with no slash", () => {
    for (const pathname of adminApiPaths) {
      expect(decideRouteAccess({ pathname, ...employee }), pathname).toEqual({
        type: "json",
        status: 403,
        error: "Not allowed",
      });
    }
  });

  it("lets an admin through /admin and /api/admin", () => {
    expect(decideRouteAccess({ pathname: "/admin", ...admin })).toEqual({ type: "next" });
    expect(decideRouteAccess({ pathname: "/api/admin/stats", ...admin })).toEqual({ type: "next" });
  });

  it("lets employees and admins through /employee and /api/employee", () => {
    expect(decideRouteAccess({ pathname: "/employee/submissions/exp_1", ...employee })).toEqual({
      type: "next",
    });
    expect(decideRouteAccess({ pathname: "/api/employee/expenses", ...employee })).toEqual({
      type: "next",
    });
    expect(decideRouteAccess({ pathname: "/employee", ...admin })).toEqual({ type: "next" });
  });
});
