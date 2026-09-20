import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { changePassword } from "./change-password";

vi.mock("@/lib/db", () => ({
  db: { user: { findUnique: vi.fn(), update: vi.fn() } },
}));

const findUnique = vi.mocked(db.user.findUnique);
const update = vi.mocked(db.user.update);

const OLD = "old-password-123";
const NEW = "brand-new-password-456";

beforeEach(async () => {
  findUnique.mockReset();
  update.mockReset();
  findUnique.mockResolvedValue({ passwordHash: await hashPassword(OLD) } as never);
  update.mockResolvedValue({} as never);
});

describe("changePassword", () => {
  it("stores a hash of the new password for the signed-in user; the old password then fails", async () => {
    const result = await changePassword("user_a", { currentPassword: OLD, newPassword: NEW, confirmPassword: NEW });
    expect(result).toEqual({ ok: true });
    const call = update.mock.calls[0]![0]!;
    expect(call.where).toEqual({ id: "user_a" });
    const stored = String((call.data as { passwordHash: string }).passwordHash);
    expect(stored).not.toContain(NEW);
    expect(await verifyPassword(stored, NEW)).toBe(true);
    expect(await verifyPassword(stored, OLD)).toBe(false);
  });

  it("rejects a wrong current password and changes nothing", async () => {
    const result = await changePassword("user_a", { currentPassword: "wrong-password-1", newPassword: NEW, confirmPassword: NEW });
    expect(result.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects a short, mismatched or unchanged password", async () => {
    expect((await changePassword("user_a", { currentPassword: OLD, newPassword: "short", confirmPassword: "short" })).ok).toBe(false);
    expect((await changePassword("user_a", { currentPassword: OLD, newPassword: NEW, confirmPassword: NEW + "x" })).ok).toBe(false);
    expect((await changePassword("user_a", { currentPassword: OLD, newPassword: OLD, confirmPassword: OLD })).ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("never returns or logs a password", async () => {
    const log = vi.spyOn(console, "log");
    const error = vi.spyOn(console, "error");
    const result = await changePassword("user_a", { currentPassword: "wrong-password-1", newPassword: NEW, confirmPassword: NEW });
    expect(JSON.stringify(result)).not.toContain(NEW);
    expect(JSON.stringify(result)).not.toContain("wrong-password-1");
    expect(JSON.stringify([...log.mock.calls, ...error.mock.calls])).not.toContain(NEW);
    log.mockRestore();
    error.mockRestore();
  });
});
