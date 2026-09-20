import { z } from "zod";

const emailSchema = z.string().email().max(254);

function firstString(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? "");
  return String(value ?? "");
}

/** Normalise credentials from the login form or from Auth.js. Extra keys are ignored. */
export function parseCredentials(raw: unknown): { email: string; password: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const email = firstString(record.email).trim().toLowerCase();
  const password = firstString(record.password);
  if (!emailSchema.safeParse(email).success) return null;
  if (password.length < 1 || password.length > 200) return null;
  return { email, password };
}
