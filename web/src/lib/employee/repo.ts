import type { EmployeeRepository } from "@/contracts/employee";
import { fixtureEmployeeRepo } from "@/fixtures/employee";

export function employeeDataMode(): "fixtures" | "db" {
  return process.env.AUDITX_DATA === "db" ? "db" : "fixtures";
}

/**
 * Employee screens stay on fixtures until section 7. AUDITX_DATA=db is rejected until
 * the Prisma implementation lands.
 */
export function getEmployeeRepo(): EmployeeRepository {
  if (employeeDataMode() === "db") {
    throw new Error("Employee db repository is not implemented. Set AUDITX_DATA=fixtures.");
  }
  return fixtureEmployeeRepo;
}
