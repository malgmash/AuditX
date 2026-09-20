import { NextResponse } from "next/server";
import { HttpError } from "@/lib/auth/http";
import { withRole } from "@/lib/auth/with-role";
import { reverseHoldSchema } from "@/lib/admin/decide-schema";
import { getAdminRepo } from "@/lib/admin/repo";

/**
 * Release a hold. One call, an optional note.
 *
 * The repository sets the release time, restores the points with a new score event, writes an
 * audit row and tells the employee. Nothing is edited in place, and a hold that is already
 * released is refused with 409 so a double click cannot restore the points twice.
 */
export const POST = withRole<{ id: string }>("ADMIN", async (req, { user, params }) => {
  const { id } = await params;

  let body: unknown = {};
  const text = await req.text();
  if (text.trim()) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new HttpError(400, "Expected a JSON body");
    }
  }

  const parsed = reverseHoldSchema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(422, parsed.error.issues[0]?.message ?? "Invalid request");
  }

  try {
    const result = await getAdminRepo().reverseHold({
      holdId: id,
      note: parsed.data.note?.length ? parsed.data.note : null,
      actor: { id: user.id, name: user.name },
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof HttpError) throw err;
    const message = err instanceof Error ? err.message : "";
    if (message.includes("already been released")) throw new HttpError(409, "This hold has already been released");
    if (message.includes("Unknown hold")) throw new HttpError(404, "No such hold");
    throw err;
  }
});
