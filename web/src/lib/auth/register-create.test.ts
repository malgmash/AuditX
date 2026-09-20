import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { DEMO_ORG_ID } from "./org";
import { createEmployeeAccount } from "./register";

vi.mock("@/lib/db", () => ({
  db: {
    organization: { findUnique: vi.fn(), findFirst: vi.fn() },
    user: { create: vi.fn() },
  },
}));

const findUnique = vi.mocked(db.organization.findUnique);
const findFirst = vi.mocked(db.organization.findFirst);
const create = vi.mocked(db.user.create);

const valid = {
  name: "Alex Chen",
  email: "alex.chen@example.com",
  password: "s3cret-password",
  confirmPassword: "s3cret-password",
  department: "Sales",
  jobTitle: "Account executive",
  startDate: "2026-03-02",
  joinCode: "auditx-join-2026",
};

describe("createEmployeeAccount organisation", () => {
  beforeEach(() => {
    findUnique.mockReset();
    findFirst.mockReset();
    create.mockReset();
    process.env.ORG_JOIN_CODE = valid.joinCode;
  });

  it("attaches joiners to the seeded demo organisation by id, not the first organisation row", async () => {
    findUnique.mockResolvedValue({ id: DEMO_ORG_ID, name: "Demo Company", headcount: 45 });
    create.mockResolvedValue({} as never);

    const result = await createEmployeeAccount(valid);

    expect(result).toEqual({ ok: true, email: valid.email });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: DEMO_ORG_ID },
      select: { id: true },
    });
    expect(findFirst).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: DEMO_ORG_ID,
        role: "EMPLOYEE",
        email: valid.email,
      }),
    });
    const payload = create.mock.calls[0]?.[0]?.data as { passwordHash: string };
    expect(payload.passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(JSON.stringify(payload)).not.toContain(valid.password);
  });
});
