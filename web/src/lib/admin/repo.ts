import type { AdminRepository } from "@/contracts/admin";
import { fixtureAdminRepo } from "@/fixtures/admin";

export function adminDataMode(): "fixtures" | "db" {
  return process.env.AUDITX_DATA === "db" ? "db" : "fixtures";
}

/**
 * AUDITX_DATA=db reads and writes Postgres. Anything else uses fixtures, so every screen works
 * with the network unplugged. The db implementation lands in section 8; until then both modes
 * resolve to fixtures rather than failing at import time.
 */
export function getAdminRepo(): AdminRepository {
  return fixtureAdminRepo;
}
