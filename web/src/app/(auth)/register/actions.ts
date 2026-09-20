"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { createEmployeeAccount, createOrganizationAccount } from "@/lib/auth/register";

export type RegisterState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

function readFields(formData: FormData) {
  // role is never read from the request. Sign-up always creates an EMPLOYEE.
  return {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
    department: String(formData.get("department") ?? ""),
    jobTitle: String(formData.get("jobTitle") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    joinCode: String(formData.get("joinCode") ?? ""),
  };
}

function readOrganizationFields(formData: FormData) {
  // role is never read from the request here either. This form's role comes from
  // createOrganizationAccount, which only administers the organisation it creates itself.
  return {
    organizationName: String(formData.get("organizationName") ?? ""),
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
  };
}

/** Signs the new account in and sends it to its dashboard. Throws the Next redirect on success. */
async function signInAfterCreate(email: string, password: string, home: string) {
  try {
    await signIn("credentials", { email, password, redirectTo: home });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Account created. Sign in to continue." };
    }
    throw err;
  }
  return {};
}

export async function registerAccount(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const fields = readFields(formData);
  const created = await createEmployeeAccount(fields);
  if (!created.ok) {
    return { error: created.error, fieldErrors: created.fieldErrors };
  }
  return signInAfterCreate(created.email, fields.password, "/employee");
}

export async function registerOrganization(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const fields = readOrganizationFields(formData);
  const created = await createOrganizationAccount(fields);
  if (!created.ok) {
    return { error: created.error, fieldErrors: created.fieldErrors };
  }
  return signInAfterCreate(created.email, fields.password, "/admin");
}
