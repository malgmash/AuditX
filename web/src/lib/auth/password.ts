import { randomUUID } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";

// argon2id with the library defaults, which follow the current OWASP guidance.
export function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

export async function verifyPassword(stored: string, plain: string): Promise<boolean> {
  try {
    return await verify(stored, plain);
  } catch {
    return false;
  }
}

let dummy: Promise<string> | undefined;

/** A real argon2 hash of a random value, computed once, used to equalise timing for unknown emails. */
export function dummyHash(): Promise<string> {
  return (dummy ??= hashPassword(randomUUID()));
}
