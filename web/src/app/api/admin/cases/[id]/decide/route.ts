import { NextResponse } from "next/server";
import { HttpError } from "@/lib/auth/http";
import { withRole } from "@/lib/auth/with-role";
import { adminDataMode, getAdminRepo } from "@/lib/admin/repo";
import { decideSchema } from "@/lib/admin/decide-schema";
import { createNotification } from "@/lib/notifications/create";

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

  // The employee is told what happened and can read the reason. Only on the database path:
  // fixture subjects have no user row to notify, and a missing recipient is not a reason to
  // fail a decision that has already been recorded.
  if (adminDataMode() === "db") {
    await createNotification({
      userId: existing.subject.id,
      kind: "CASE_DECIDED",
      title: parsed.data.decision === "ACCEPTED" ? "A case was reviewed" : "A flag was cleared",
      body:
        parsed.data.decision === "ACCEPTED"
          ? "A reviewer looked at a flag on your record and recorded that it needs a next step."
          : "A reviewer looked at a flag on your record and took no action. Your points have been restored.",
      linkPath: "/employee",
    });
  }

  return NextResponse.json(result);
});
