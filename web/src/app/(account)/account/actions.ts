"use server";

import { getSessionUser } from "@/lib/auth/session";
import { changePassword } from "@/lib/auth/change-password";

export type ChangePasswordState = {
  done?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export async function changePasswordAction(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const user = await getSessionUser();
  if (!user) return { error: "Please sign in again" };
  const result = await changePassword(user.id, {
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });
  return result.ok ? { done: true } : { error: result.error, fieldErrors: result.fieldErrors };
}
