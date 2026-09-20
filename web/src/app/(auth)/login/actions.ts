"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { signIn } from "@/auth";
import { clientIp, loginThrottle, tooManyMessage } from "@/lib/auth/rate-limit";

export type LoginState = { error?: string };

// One message for every failure, so a wrong email and a wrong password look the same.
const GENERIC = "Email or password is incorrect";

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const callbackUrl = String(formData.get("callbackUrl") ?? "");
  // Only allow same-site relative redirects.
  const redirectTo =
    callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const ip = clientIp(await headers());
  const gate = loginThrottle.check(email, ip);
  if (gate.blocked) return { error: tooManyMessage(gate) };
  try {
    await signIn("credentials", {
      email,
      password: String(formData.get("password") ?? ""),
      redirectTo,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      // authorize() counted the email. The address is only known here, so count it here.
      if (ip) loginThrottle.failAddress(ip);
      return { error: GENERIC };
    }
    throw err; // the redirect on success is thrown by Next and must propagate
  }
  return {};
}
