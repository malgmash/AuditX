/**
 * The two sample accounts, for one-click sign-in from the login page. The values must match
 * `web/prisma/seed.ts`, which creates them. They are only ever read on the server: the login page
 * sends a role name, never a password.
 */
export const DEMO_ACCOUNTS = {
  admin: { email: "admin@auditx.local", password: "AuditX-admin-2026", home: "/admin" },
  employee: { email: "employee@auditx.local", password: "AuditX-employee-2026", home: "/employee" },
} as const;

export type DemoRole = keyof typeof DEMO_ACCOUNTS;

export function isDemoRole(value: string): value is DemoRole {
  return value === "admin" || value === "employee";
}

/** On unless `DEMO_LOGIN=off`. Switch it off for a deployment that holds real people's data. */
export function demoLoginEnabled(): boolean {
  return process.env.DEMO_LOGIN !== "off";
}
