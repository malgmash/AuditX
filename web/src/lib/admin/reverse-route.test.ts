import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "@/lib/auth/http";
import type { SessionUser } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({
  requireRole: vi.fn(),
  requireUser: vi.fn(),
}));

import { requireRole } from "@/lib/auth/session";
import { POST } from "@/app/api/admin/holds/[id]/reverse/route";

const admin: SessionUser = {
  id: "usr_admin",
  role: "ADMIN",
  name: "K. Salama",
  email: "admin@auditx.local",
  department: "Operations",
};

const post = (holdId: string, body?: unknown) =>
  POST(
    new Request(`http://localhost/api/admin/holds/${holdId}/reverse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: holdId }) },
  );

describe("POST /api/admin/holds/[id]/reverse", () => {
  beforeEach(() => {
    vi.mocked(requireRole).mockReset();
  });

  it("refuses an employee with 403 and a signed-out caller with 401", async () => {
    vi.mocked(requireRole).mockRejectedValueOnce(new HttpError(403, "Not allowed"));
    expect((await post("hold_ok_lunch")).status).toBe(403);
    vi.mocked(requireRole).mockRejectedValueOnce(new HttpError(401, "Sign in required"));
    expect((await post("hold_ok_lunch")).status).toBe(401);
  });

  it("rejects a note longer than the limit", async () => {
    vi.mocked(requireRole).mockResolvedValue(admin);
    expect((await post("hold_ok_lunch", { note: "x".repeat(501) })).status).toBe(422);
  });

  it("returns 404 for a hold that does not exist", async () => {
    vi.mocked(requireRole).mockResolvedValue(admin);
    expect((await post("hold_missing")).status).toBe(404);
  });

  it("releases a hold with no body, then refuses the second attempt with 409", async () => {
    vi.mocked(requireRole).mockResolvedValue(admin);
    const first = await post("hold_pv_dell");
    expect(first.status).toBe(200);
    const result = (await first.json()) as { holdId: string; subjectScoreBefore: number; subjectScoreAfter: number };
    expect(result.holdId).toBe("hold_pv_dell");
    expect(result.subjectScoreAfter).toBeGreaterThan(result.subjectScoreBefore);

    const second = await post("hold_pv_dell");
    expect(second.status).toBe(409);
  });

  it("takes an optional note", async () => {
    vi.mocked(requireRole).mockResolvedValue(admin);
    expect((await post("hold_ok_lunch", { note: "Confirmed with the employee" })).status).toBe(200);
  });
});
