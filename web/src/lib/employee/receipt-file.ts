import { createHash, randomUUID } from "node:crypto";
import { MAX_RECEIPT_BYTES } from "@/lib/employee/config";

export { isReceiptImage } from "@/lib/employee/receipt-client";

export function receiptTooLarge(size: number): boolean {
  return size > MAX_RECEIPT_BYTES;
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Deterministic stand-in for a 256-bit perceptual hash until analysis delivers imaging. */
export function placeholderPhash(sha256: string): string {
  return createHash("sha256").update(`phash:${sha256}`).digest("hex");
}

export function newReceiptId(): string {
  return `rec_${randomUUID()}`;
}

export function receiptStorageKey(userId: string, receiptId: string, mimeType: string): string {
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  return `receipts/${userId}/${receiptId}.${ext}`;
}

export type StoredReceipt = {
  bytes: Uint8Array;
  mimeType: string;
};

export type ReceiptStorage = {
  put(key: string, bytes: Uint8Array, mimeType: string): Promise<void>;
  get(key: string): Promise<StoredReceipt | null>;
};

export function createMemoryReceiptStorage(): ReceiptStorage {
  const files = new Map<string, StoredReceipt>();
  return {
    async put(key, bytes, mimeType) {
      files.set(key, { bytes, mimeType });
    },
    async get(key) {
      return files.get(key) ?? null;
    },
  };
}

export const memoryReceiptStorage = createMemoryReceiptStorage();
