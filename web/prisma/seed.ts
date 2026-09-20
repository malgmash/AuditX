// Seeds one organisation, one administrator and one employee with known development passwords.
// The synthetic dataset (45 employees, six months) is created by the analysis service generator.
// Run: npm run db:seed

import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const db = new PrismaClient();

// Must match DEMO_ORG_ID in web/src/lib/auth/org.ts. The join-code sign-up path attaches to this row.
const ORG_ID = "org_auditx_demo";

// Shared by every generated employee (name.NN@auditx.demo). Development only.
const DEMO_EMPLOYEE_PASSWORD = "AuditX-demo-2026";

const users = [
  {
    email: "admin@auditx.local",
    password: "AuditX-admin-2026",
    name: "Morgan Reyes",
    role: "ADMIN" as const,
    department: "Operations",
    jobTitle: "Operations lead",
  },
  {
    email: "employee@auditx.local",
    password: "AuditX-employee-2026",
    name: "Jamie Okafor",
    role: "EMPLOYEE" as const,
    department: "Sales",
    jobTitle: "Account executive",
  },
];

async function main() {
  await db.organization.upsert({
    where: { id: ORG_ID },
    update: {},
    create: { id: ORG_ID, name: "Demo Company", headcount: 45 },
  });

  for (const u of users) {
    const passwordHash = await hash(u.password);
    await db.user.upsert({
      where: { email: u.email },
      update: { passwordHash, name: u.name, role: u.role, department: u.department, jobTitle: u.jobTitle },
      create: {
        orgId: ORG_ID,
        email: u.email,
        passwordHash,
        name: u.name,
        role: u.role,
        department: u.department,
        jobTitle: u.jobTitle,
        startDate: new Date("2025-01-06T00:00:00Z"),
      },
    });
    console.log(`seeded ${u.role.toLowerCase()}: ${u.email}`);
  }

  // The generated employees are created with sign-in disabled. Give them one shared demo password
  // so the demo can sign in as someone with real findings. Accounts that already have a password
  // are left alone, so this never overwrites a real sign-up.
  const passwordHash = await hash(DEMO_EMPLOYEE_PASSWORD);
  const enabled = await db.user.updateMany({
    where: { orgId: ORG_ID, passwordHash: { startsWith: "!" } },
    data: { passwordHash },
  });
  console.log(`enabled sign-in for ${enabled.count} generated employees`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
