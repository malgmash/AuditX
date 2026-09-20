import { NextResponse } from "next/server";
import { HttpError } from "@/lib/auth/http";
import { withUser } from "@/lib/auth/with-role";
import { isReceiptImage, receiptTooLarge } from "@/lib/employee/receipt-file";
import { extractReceiptImage } from "@/lib/employee/submit-expense";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = withUser(async (req) => {
  const form = await req.formData();
  const receipt = form.get("receipt");
  if (!(receipt instanceof File) || receipt.size === 0) {
    throw new HttpError(422, "Attach a receipt image.");
  }
  if (!isReceiptImage(receipt)) {
    throw new HttpError(422, "The receipt must be an image.");
  }
  if (receiptTooLarge(receipt.size)) {
    throw new HttpError(422, "That image is too large. Use a file under 8 MB.");
  }
  const result = await extractReceiptImage(receipt);
  return NextResponse.json({
    fallback: result.fallback,
    extraction: result.extraction,
  });
});
