import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(200),
    newPassword: z.string().min(10, "Password must be at least 10 characters").max(200),
    confirmPassword: z.string().max(200),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    path: ["newPassword"],
    message: "Choose a password different from the current one",
  });

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

/**
 * Changes the password of the signed-in user. The user id comes from the session, never from the
 * request. No password is logged or returned. The session token is not touched: it carries no
 * password, so the user stays signed in here, and the old password stops working for new sign-ins.
 */
export async function changePassword(userId: string, input: unknown): Promise<ChangePasswordResult> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const user = await db.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user || !(await verifyPassword(user.passwordHash, parsed.data.currentPassword))) {
    return { ok: false, error: "Your current password is not correct", fieldErrors: { currentPassword: ["Not correct"] } };
  }
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(parsed.data.newPassword) } });
  return { ok: true };
}
