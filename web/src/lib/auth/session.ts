import { auth } from "@/auth";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/auth/http";

export type Role = "EMPLOYEE" | "ADMIN";

export type SessionUser = {
  id: string;
  orgId: string;
  role: Role;
  name: string;
  email: string;
  department: string;
};

/**
 * The signed-in user, or null. The role in the JWT is only a claim, so the user and their
 * role are re-read from the database on every call. A user who was removed or demoted loses
 * access immediately, without waiting for the token to expire.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, orgId: true, role: true, name: true, email: true, department: true },
  });
  return user ?? null;
}

/** Throws HttpError 401 when nobody is signed in. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Sign in required");
  return user;
}

/** Throws HttpError 401 when nobody is signed in and 403 when the role does not match. */
export async function requireRole(role: "ADMIN"): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== role) throw new HttpError(403, "Not allowed");
  return user;
}
