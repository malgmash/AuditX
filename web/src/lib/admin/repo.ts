import type { AdminRepository } from "@/contracts/admin";
import { fixtureAdminRepo } from "@/fixtures/admin";
import { createDbAdminRepo } from "@/lib/admin/db-repo";

export function adminDataMode(): "fixtures" | "db" {
  return process.env.AUDITX_DATA === "db" ? "db" : "fixtures";
}

let dbRepo: AdminRepository | undefined;

/**
 * AUDITX_DATA=db reads Postgres and hands decisions and reversals to the analysis service.
 * Anything else uses fixtures, which work with no database and no analysis service.
 */
export function getAdminRepo(): AdminRepository {
  if (adminDataMode() === "db") {
    dbRepo ??= createDbAdminRepo();
    return dbRepo;
  }
  return fixtureAdminRepo;
}
