import { FIXTURE_EMPLOYEES } from "@/fixtures/employee";
import { employeeDataMode } from "@/lib/employee/repo";

/** Map the signed-in user onto fixture ids while AUDITX_DATA=fixtures. */
export function resolveActingUserId(user: { id: string; email: string }): string {
  if (employeeDataMode() === "db") return user.id;
  const override = process.env.AUDITX_FIXTURE_USER;
  if (override) return override;
  const match = (Object.entries(FIXTURE_EMPLOYEES) as Array<[string, { email: string }]>).find(
    ([, person]) => person.email === user.email,
  );
  return match?.[0] ?? user.id;
}
