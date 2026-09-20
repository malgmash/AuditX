import { NextResponse } from "next/server";
import { HttpError } from "@/lib/auth/http";
import { withRole } from "@/lib/auth/with-role";
import { getAdminRepo } from "@/lib/admin/repo";
import { decideSchema } from "@/lib/admin/decide-schema";

/**
 * Record a decision on a case.
 *
 * Middleware is the first layer; withRole re-checks the role here, so a stale token cannot
 * reach this handler. The repository writes the audit row and the score event as one step,
 * which is what keeps an administrator action from ever going unrecorded.
 */
export const POST = withRole<{ id: string }>("ADMIN", async (req, { user, params }) => {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Expected a JSON body");
  }

  const parsed = decideSchema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(422, parsed.error.issues[0]?.message ?? "Invalid decision");
  }

  const repo = getAdminRepo();
  const existing = await repo.getCase(id);
  if (!existing) throw new HttpError(404, "No such case");
  if (existing.status !== "OPEN") throw new HttpError(409, "This case has already been decided");

  const result = await repo.decideCase({
    caseId: id,
    decision: parsed.data.decision,
    note: parsed.data.note?.length ? parsed.data.note : null,
    actor: { id: user.id, name: user.name },
  });

  // On the database path the analysis service does the whole decision in one call, including the
  // notification to the employee, so nothing is sent from here. Fixture subjects have no user row.

  return NextResponse.json(result);
});
