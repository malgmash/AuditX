import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "./http";
import type { SessionUser } from "./session";

vi.mock("./session", () => ({
  requireRole: vi.fn(),
  requireUser: vi.fn(),
}));

import { requireRole, requireUser } from "./session";
import { withRole, withUser } from "./with-role";

const admin: SessionUser = {
  id: "user_admin",
  orgId: "org_auditx_demo",
  role: "ADMIN",
  name: "Morgan Reyes",
  email: "admin@auditx.local",
  department: "Operations",
};

const employee: SessionUser = {
  id: "user_employee",
  orgId: "org_auditx_demo",
  role: "EMPLOYEE",
  name: "Jamie Okafor",
  email: "employee@auditx.local",
  department: "Sales",
};

const emptyCtx = { params: Promise.resolve({}) };

describe("withRole", () => {
  beforeEach(() => {
    vi.mocked(requireRole).mockReset();
    vi.mocked(requireUser).mockReset();
  });

  it("returns 403 when an employee hits an admin handler", async () => {
    vi.mocked(requireRole).mockRejectedValue(new HttpError(403, "Not allowed"));
    const GET = withRole("ADMIN", async () => NextResponse.json({ ok: true }));
    const res = await GET(new Request("http://localhost/api/admin/stats"), emptyCtx);
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Not allowed" });
  });

  it("returns 401 when nobody is signed in", async () => {
    vi.mocked(requireRole).mockRejectedValue(new HttpError(401, "Sign in required"));
    const GET = withRole("ADMIN", async () => NextResponse.json({ ok: true }));
    const res = await GET(new Request("http://localhost/api/admin/stats"), emptyCtx);
    expect(res.status).toBe(401);
  });

  it("runs the handler when the user is an administrator", async () => {
    vi.mocked(requireRole).mockResolvedValue(admin);
    const GET = withRole("ADMIN", async (_req, { user }) => NextResponse.json({ id: user.id }));
    const res = await GET(new Request("http://localhost/api/admin/stats"), emptyCtx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id: admin.id });
  });
});

describe("withUser", () => {
  beforeEach(() => {
    vi.mocked(requireUser).mockReset();
  });

  it("returns 401 when nobody is signed in", async () => {
    vi.mocked(requireUser).mockRejectedValue(new HttpError(401, "Sign in required"));
    const GET = withUser(async () => NextResponse.json({ ok: true }));
    const res = await GET(new Request("http://localhost/api/employee/expenses"), emptyCtx);
    expect(res.status).toBe(401);
  });

  it("passes the signed-in employee into the handler", async () => {
    vi.mocked(requireUser).mockResolvedValue(employee);
    const GET = withUser(async (_req, { user }) => NextResponse.json({ id: user.id }));
    const res = await GET(new Request("http://localhost/api/employee/expenses"), emptyCtx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id: employee.id });
  });
});
