import { NextResponse } from "next/server";
import { withUser } from "@/lib/auth/with-role";
import { resolveActingUserId } from "@/lib/employee/acting-user";
import { readSampleReceipt } from "@/lib/employee/receipt-samples";
import { findOwnReceipt } from "@/lib/employee/submission-detail";
import { getReceiptStorage } from "@/lib/receipt-storage";

export const runtime = "nodejs";

/** Serves the acting employee's own receipt image. Anyone else's id is a 404, never a 403. */
export const GET = withUser<{ id: string }>(async (_req, { user, params }) => {
  const { id } = await params;
  const receipt = await findOwnReceipt(resolveActingUserId(user), id);
  if (!receipt) return notFoundJson();

  const stored = await getReceiptStorage().get(receipt.storageKey);
  if (stored) return imageResponse(stored.bytes, stored.mimeType);

  const sample = await readSampleReceipt(receipt.storageKey);
  if (sample) return imageResponse(sample, receipt.mimeType);

  return notFoundJson();
});

function imageResponse(bytes: Uint8Array, mimeType: string): Response {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "private, max-age=300",
    },
  });
}

function notFoundJson(): NextResponse {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
