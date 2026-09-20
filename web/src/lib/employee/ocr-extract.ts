import type { ExtractInput, ExtractProvider, ExtractResult } from "@/lib/employee/extract";
import { extractionFromOcrText } from "@/lib/employee/ocr-parse";
import { placeholderPhash, sha256Hex } from "@/lib/employee/receipt-file";

const MIN_OCR_BYTES = 2048;

export type RecognizeReceipt = (bytes: Uint8Array, mimeType: string) => Promise<string>;

async function recognizeWithTesseract(bytes: Uint8Array): Promise<string> {
  const mod = await import("tesseract.js");
  const Tesseract = mod.default;
  const result = await Tesseract.recognize(Buffer.from(bytes), "eng", {
    logger: () => undefined,
  });
  return result.data.text ?? "";
}

export function createOcrExtractProvider(opts?: { recognize?: RecognizeReceipt }): ExtractProvider {
  const recognize = opts?.recognize ?? ((input) => recognizeWithTesseract(input));
  return {
    async extract(input: ExtractInput): Promise<ExtractResult> {
      const sha256 = sha256Hex(input.bytes);
      const phash = placeholderPhash(sha256);
      if (input.bytes.byteLength < MIN_OCR_BYTES) {
        return { fallback: true, extraction: null, phash };
      }
      try {
        const text = await recognize(input.bytes, input.mimeType);
        const extraction = extractionFromOcrText(text);
        if (!extraction) return { fallback: true, extraction: null, phash };
        return { fallback: false, extraction, phash };
      } catch {
        return { fallback: true, extraction: null, phash };
      }
    },
  };
}
