import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createEmployeeAccount, createOrganizationAccount } from "./register";

const tx = {
  organization: { create: vi.fn() },
  user: { create: vi.fn() },
};
type Tx = typeof tx;

vi.mock("@/lib/db", () => ({
  db: {
    organization: { findUnique: vi.fn() },
    user: { create: vi.fn(), findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const findUnique = vi.mocked(db.organization.findUnique);
const create = vi.mocked(db.user.create);
// Loosely typed: the real Prisma signatures for $transaction and user.findUnique want a full
// TransactionClient / User row, which fights a hand-built tx stub and a partial mock value.
const userFindUnique = db.user.findUnique as unknown as ReturnType<typeof vi.fn>;
const $transaction = db.$transaction as unknown as ReturnType<typeof vi.fn>;

const valid = {
  name: "Alex Chen",
  email: "alex.chen@example.com",
  password: "s3cret-password",
  confirmPassword: "s3cret-password",
  department: "Sales",
  jobTitle: "Account executive",
  startDate: "2026-03-02",
  joinCode: "abcd2345",
};

describe("createEmployeeAccount organisation", () => {
  beforeEach(() => {
    findUnique.mockReset();
    create.mockReset();
  });

  it("looks up the organisation by its own join code, normalised to uppercase, and attaches the joiner to it", async () => {
    findUnique.mockResolvedValue({ id: "org_new_northwind", name: "Northwind Partners", headcount: 12, joinCode: "ABCD2345" });
    create.mockResolvedValue({} as never);

    const result = await createEmployeeAccount(valid);

    expect(result).toEqual({ ok: true, email: valid.email });
    expect(findUnique).toHaveBeenCalledWith({
      where: { joinCode: "ABCD2345" },
      select: { id: true },
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: "org_new_northwind",
        role: "EMPLOYEE",
        email: valid.email,
      }),
    });
    const payload = create.mock.calls[0]?.[0]?.data as { passwordHash: string };
    expect(payload.passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(JSON.stringify(payload)).not.toContain(valid.password);
  });

  it("rejects a join code that matches no organisation", async () => {
    findUnique.mockResolvedValue(null);

    const result = await createEmployeeAccount(valid);

    expect(result).toEqual({
      ok: false,
      error: "The join code is not valid",
      fieldErrors: { joinCode: ["Check the code with your administrator"] },
    });
    expect(create).not.toHaveBeenCalled();
  });
});

const validOrganization = {
  organizationName: "Northwind Partners",
  name: "Dana Okonjo",
  email: "dana.okonjo@northwind.com",
  password: "s3cret-password",
  confirmPassword: "s3cret-password",
  startDate: "2026-04-01",
};

describe("createOrganizationAccount", () => {
  beforeEach(() => {
    userFindUnique.mockReset();
    tx.organization.create.mockReset();
    tx.user.create.mockReset();
    $transaction.mockReset();
    $transaction.mockImplementation(async (cb: (t: Tx) => unknown) => cb(tx));
  });

  it("generates a join code, stores it on the new organisation, and returns it for the founder", async () => {
    userFindUnique.mockResolvedValue(null); // email not taken
    tx.organization.create.mockResolvedValue({ id: "org_new_northwind" });
    tx.user.create.mockResolvedValue({} as never);

    const result = await createOrganizationAccount(validOrganization);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.joinCode).toMatch(/^[A-Z2-9]{8}$/);
    expect(tx.organization.create).toHaveBeenCalledWith({
      data: { name: validOrganization.organizationName, headcount: 1, joinCode: result.joinCode },
      select: { id: true },
    });
    expect(tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ role: "ADMIN", orgId: "org_new_northwind" }),
    });
  });

  it("rejects a duplicate email before opening a transaction", async () => {
    userFindUnique.mockResolvedValue({ id: "existing_user" });

    const result = await createOrganizationAccount(validOrganization);

    expect(result).toEqual({ ok: false, error: "An account with this email already exists" });
    expect($transaction).not.toHaveBeenCalled();
  });
});
