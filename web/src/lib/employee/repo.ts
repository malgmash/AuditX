import type { EmployeeRepository } from "@/contracts/employee";
import { fixtureEmployeeRepo } from "@/fixtures/employee";
import { createDbEmployeeRepo } from "@/lib/employee/db-repo";

export function employeeDataMode(): "fixtures" | "db" {
  return process.env.AUDITX_DATA === "db" ? "db" : "fixtures";
}

/** AUDITX_DATA=db reads and writes Postgres for the signed-in user. Anything else uses fixtures. */
let dbRepo: EmployeeRepository | undefined;

export function getEmployeeRepo(): EmployeeRepository {
  if (employeeDataMode() === "db") {
    dbRepo ??= createDbEmployeeRepo();
    return dbRepo;
  }
  return fixtureEmployeeRepo;
}
