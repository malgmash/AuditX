import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { sampleReceiptFileName } from "@/fixtures/employee/receipt-images";

/** The sample photographs live beside the analysis samples. Read only, never written. */
const SAMPLES_DIR = path.join(process.cwd(), "..", "analysis", "data", "samples", "receipts");

export function sampleReceiptPath(storageKey: string): string | null {
  const name = sampleReceiptFileName(storageKey);
  return name ? path.join(SAMPLES_DIR, name) : null;
}

export async function sampleReceiptExists(storageKey: string): Promise<boolean> {
  const filePath = sampleReceiptPath(storageKey);
  if (!filePath) return false;
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readSampleReceipt(storageKey: string): Promise<Uint8Array | null> {
  const filePath = sampleReceiptPath(storageKey);
  if (!filePath) return null;
  try {
    return await readFile(filePath);
  } catch {
    return null;
  }
}
