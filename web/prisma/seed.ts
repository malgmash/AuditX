// Seeds one organisation, one administrator and one employee with known development passwords.
// The synthetic dataset (45 employees, six months) is created by the analysis service generator.
// Run: npm run db:seed

import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const db = new PrismaClient();

const ORG_ID = "org_auditx_demo";

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
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
