import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "@/lib/auth/http";
import type { SessionUser } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({
  requireRole: vi.fn(),
  requireUser: vi.fn(),
}));

// The fixture path never notifies, but the route imports this, so keep it inert under test.
vi.mock("@/lib/notifications/create", () => ({ createNotification: vi.fn() }));

import { requireRole } from "@/lib/auth/session";
import { POST } from "@/app/api/admin/cases/[id]/decide/route";

const admin: SessionUser = {
  id: "usr_admin",
  role: "ADMIN",
  name: "K. Salama",
  email: "admin@auditx.local",
  department: "Operations",
};

const post = (caseId: string, body: unknown) =>
  POST(
    new Request(`http://localhost/api/admin/cases/${caseId}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: caseId }) },
  );

describe("POST /api/admin/cases/[id]/decide", () => {
  beforeEach(() => {
    vi.mocked(requireRole).mockReset();
  });

  it("refuses an employee with 403", async () => {
    vi.mocked(requireRole).mockRejectedValue(new HttpError(403, "Not allowed"));

    const res = await post("case_4471", { decision: "ACCEPTED" });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Not allowed" });
  });

  it("refuses a signed-out caller with 401", async () => {
    vi.mocked(requireRole).mockRejectedValue(new HttpError(401, "Sign in required"));

    const res = await post("case_4471", { decision: "ACCEPTED" });

    expect(res.status).toBe(401);
  });

  it("rejects a decision it does not recognise", async () => {
    vi.mocked(requireRole).mockResolvedValue(admin);

    const res = await post("case_4471", { decision: "MAYBE" });

    expect(res.status).toBe(422);
  });

  it("rejects a note longer than the limit", async () => {
    vi.mocked(requireRole).mockResolvedValue(admin);

    const res = await post("case_4471", { decision: "DECLINED", note: "x".repeat(501) });

    expect(res.status).toBe(422);
  });

  it("returns 404 for a case that does not exist", async () => {
    vi.mocked(requireRole).mockResolvedValue(admin);

    const res = await post("case_nope", { decision: "ACCEPTED" });

    expect(res.status).toBe(404);
  });

  it("records a decision and returns both scores", async () => {
    vi.mocked(requireRole).mockResolvedValue(admin);

    const res = await post("case_4468", { decision: "DECLINED", note: "Travel day confirmed" });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("DECLINED");
    expect(body.isSelfReview).toBe(false);
    // Declining restores the points the open case was holding.
    expect(body.subjectScoreAfter).toBeGreaterThan(body.subjectScoreBefore);
  });

  it("refuses to decide the same case twice", async () => {
    vi.mocked(requireRole).mockResolvedValue(admin);

    const res = await post("case_4468", { decision: "ACCEPTED" });

    expect(res.status).toBe(409);
  });
});
