import { describe, expect, it } from "vitest";
import { isReceiptImage, placeholderPhash, receiptTooLarge, sha256Hex } from "./receipt-file";
import { MAX_RECEIPT_BYTES } from "./config";

describe("receipt file helpers", () => {
  it("accepts image types and common camera filenames", () => {
    expect(isReceiptImage({ type: "image/jpeg", name: "blob" })).toBe(true);
    expect(isReceiptImage({ type: "", name: "IMG_0101.HEIC" })).toBe(true);
    expect(isReceiptImage({ type: "application/pdf", name: "note.pdf" })).toBe(false);
  });

  it("rejects files over the size cap", () => {
    expect(receiptTooLarge(MAX_RECEIPT_BYTES)).toBe(false);
    expect(receiptTooLarge(MAX_RECEIPT_BYTES + 1)).toBe(true);
  });

  it("hashes bytes stably", () => {
    const bytes = new Uint8Array([9, 8, 7]);
    expect(sha256Hex(bytes)).toBe(sha256Hex(bytes));
    expect(placeholderPhash(sha256Hex(bytes))).toHaveLength(64);
  });
});
