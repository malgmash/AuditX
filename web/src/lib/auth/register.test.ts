import { describe, expect, it } from "vitest";
import { hashPassword } from "./password";
import {
  organizationFieldsSchema,
  registerFieldsSchema,
  startDateUtc,
  toEmployeeCreateInput,
  toFounderCreateInput,
} from "./register";

const valid = {
  name: "Alex Chen",
  email: "Alex.Chen@Example.com",
  password: "s3cret-password",
  confirmPassword: "s3cret-password",
  department: "Sales",
  jobTitle: "Account executive",
  startDate: "2026-03-02",
  joinCode: "auditx-join-2026",
};

describe("registerFieldsSchema", () => {
  it("accepts a complete form and lowercases the email", () => {
    const parsed = registerFieldsSchema.parse(valid);
    expect(parsed.email).toBe("alex.chen@example.com");
  });

  it("rejects a password shorter than 10 characters", () => {
    const parsed = registerFieldsSchema.safeParse({ ...valid, password: "short", confirmPassword: "short" });
    expect(parsed.success).toBe(false);
  });

  it("rejects when the passwords do not match", () => {
    const parsed = registerFieldsSchema.safeParse({ ...valid, confirmPassword: "different-password" });
    expect(parsed.success).toBe(false);
  });
});

const validOrganization = {
  organizationName: "Northwind Partners",
  name: "Dana Okonjo",
  email: "Dana.Okonjo@Northwind.com",
  password: "s3cret-password",
  confirmPassword: "s3cret-password",
  startDate: "2026-04-01",
};

describe("organizationFieldsSchema", () => {
  it("accepts a complete form and lowercases the email", () => {
    const parsed = organizationFieldsSchema.parse(validOrganization);
    expect(parsed.email).toBe("dana.okonjo@northwind.com");
  });

  it("requires an organisation name", () => {
    const parsed = organizationFieldsSchema.safeParse({ ...validOrganization, organizationName: "  " });
    expect(parsed.success).toBe(false);
  });

  it("applies the same password rules as the employee form", () => {
    expect(
      organizationFieldsSchema.safeParse({ ...validOrganization, password: "short", confirmPassword: "short" })
        .success,
    ).toBe(false);
    expect(
      organizationFieldsSchema.safeParse({ ...validOrganization, confirmPassword: "different-password" })
        .success,
    ).toBe(false);
  });

  it("has no field that could name an existing organisation or a role", () => {
    const parsed = organizationFieldsSchema.parse({
      ...validOrganization,
      role: "ADMIN",
      orgId: "org_auditx_demo",
    });
    expect(parsed).not.toHaveProperty("role");
    expect(parsed).not.toHaveProperty("orgId");
  });
});

describe("toFounderCreateInput", () => {
  it("makes the founder an ADMIN of the organisation it is given, and stores no plain password", async () => {
    const parsed = organizationFieldsSchema.parse(validOrganization);
    const passwordHash = await hashPassword(validOrganization.password);
    const row = toFounderCreateInput(parsed, passwordHash, "org_new_northwind");

    expect(row.role).toBe("ADMIN");
    expect(row.orgId).toBe("org_new_northwind");
    // Not asked for at sign-up: an organisation that does not exist yet has no titles to pick from.
    expect(row.jobTitle).toBe("Administrator");
    expect(row.department).toBe("Administration");
    expect(row).not.toHaveProperty("password");
    expect(JSON.stringify(row)).not.toContain(validOrganization.password);
    expect(passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(row.startDate.toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });
});

describe("toEmployeeCreateInput", () => {
  it("forces EMPLOYEE even when the request tries to set ADMIN", async () => {
    const parsed = registerFieldsSchema.parse(valid);
    const sneaky = { ...parsed, role: "ADMIN" as const };
    const passwordHash = await hashPassword(valid.password);
    const row = toEmployeeCreateInput(sneaky, passwordHash, "org_auditx_demo");

    expect(row.role).toBe("EMPLOYEE");
    expect(row).not.toHaveProperty("password");
    expect(JSON.stringify(row)).not.toContain(valid.password);
    expect(passwordHash).not.toContain(valid.password);
    expect(passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(row.startDate).toEqual(startDateUtc("2026-03-02"));
    expect(row.startDate.toISOString()).toBe("2026-03-02T00:00:00.000Z");
  });
});
