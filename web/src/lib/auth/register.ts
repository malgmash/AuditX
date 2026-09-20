import { timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { hashPassword } from "@/lib/auth/password";
import {
  organizationFieldsSchema,
  registerFieldsSchema,
  startDateUtc,
  type OrganizationFields,
  type RegisterFields,
} from "@/lib/auth/register-schema";
import { db } from "@/lib/db";

export {
  organizationFieldsSchema,
  registerFieldsSchema,
  startDateUtc,
  type OrganizationFields,
  type RegisterFields,
} from "@/lib/auth/register-schema";

export type CreateEmployeeResult =
  | { ok: true; email: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export function joinCodesMatch(provided: string, expected: string | undefined): boolean {
  if (!expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * The only shape written to User. Role is forced to EMPLOYEE here; a role on the request
 * is ignored and never copied. The plain password is not a field on this object.
 */
export function toEmployeeCreateInput(input: RegisterFields, passwordHash: string, orgId: string) {
  return {
    orgId,
    email: input.email,
    passwordHash,
    name: input.name,
    role: "EMPLOYEE" as const,
    department: input.department,
    jobTitle: input.jobTitle,
    startDate: startDateUtc(input.startDate),
  };
}

/**
 * The only shape written to User for a founding administrator. ADMIN is forced here, and orgId can
 * only be an organisation created in the same transaction, so this never grants administrator rights
 * over an organisation that already exists.
 */
export function toFounderCreateInput(input: OrganizationFields, passwordHash: string, orgId: string) {
  return {
    orgId,
    email: input.email,
    passwordHash,
    name: input.name,
    role: "ADMIN" as const,
    // The founder has no department or job title to pick from in an organisation that does not
    // exist yet, so the row carries plain fixed labels. Both are editable later from the account page.
    department: "Administration",
    jobTitle: "Administrator",
    startDate: startDateUtc(input.startDate),
  };
}

export async function createEmployeeAccount(raw: unknown): Promise<CreateEmployeeResult> {
  const parsed = registerFieldsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  if (!joinCodesMatch(parsed.data.joinCode, process.env.ORG_JOIN_CODE)) {
    return { ok: false, error: "The join code is not valid" };
  }

  const org = await db.organization.findFirst({ select: { id: true } });
  if (!org) return { ok: false, error: "The organisation is not set up" };

  const passwordHash = await hashPassword(parsed.data.password);
  try {
    await db.user.create({
      data: toEmployeeCreateInput(parsed.data, passwordHash, org.id),
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "An account with this email already exists" };
    }
    throw err;
  }

  return { ok: true, email: parsed.data.email };
}

export async function createOrganizationAccount(raw: unknown): Promise<CreateEmployeeResult> {
  const parsed = organizationFieldsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // Checked before the transaction as well so a duplicate email does not leave an empty
  // organisation behind on the rollback.
  const taken = await db.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
  if (taken) return { ok: false, error: "An account with this email already exists" };

  const passwordHash = await hashPassword(parsed.data.password);
  try {
    await db.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: parsed.data.organizationName, headcount: 1 },
        select: { id: true },
      });
      await tx.user.create({ data: toFounderCreateInput(parsed.data, passwordHash, org.id) });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "An account with this email already exists" };
    }
    throw err;
  }

  return { ok: true, email: parsed.data.email };
}
