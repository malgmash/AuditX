import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/with-role";
import { HttpError } from "@/lib/auth/http";
import { adminDataMode } from "@/lib/admin/repo";
import { callAnalysis } from "@/lib/admin/db-repo";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Rebuild baselines, re-run every detector, open any missing cases and holds, and rescore
 * everyone. The button behind it is admin-only and asks for confirmation first. When the analysis
 * service is unreachable the caller gets a plain message and nothing has changed.
 */
export const POST = withRole("ADMIN", async () => {
  if (adminDataMode() !== "db") {
    throw new HttpError(409, "Recompute needs the database. Set AUDITX_DATA=db.");
  }
  const counts = await callAnalysis<Record<string, number>>("/internal/recompute", {}, 110000);
  return NextResponse.json({ ok: true, counts });
});
