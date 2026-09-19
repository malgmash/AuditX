"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type LoginState = { error?: string };

// One message for every failure, so a wrong email and a wrong password look the same.
const GENERIC = "Email or password is incorrect";

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const callbackUrl = String(formData.get("callbackUrl") ?? "");
  // Only allow same-site relative redirects.
  const redirectTo =
    callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/";
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo,
    });
  } catch (err) {
    if (err instanceof AuthError) return { error: GENERIC };
    throw err; // the redirect on success is thrown by Next and must propagate
  }
  return {};
}
