import { describe, expect, it } from "vitest";
import { extractionFromOcrText, parseReceiptTotalCents } from "./ocr-parse";
import { createOcrExtractProvider } from "./ocr-extract";

const UNION_HALL = `
Union Hall Coffee
Pittsburgh, USA
Store 563  Reg 9
09/09/2026 16:30
Order #62033
Espresso                    6.58
Cobb salad                  6.22
Subtotal                   12.80
TOTAL                      12.80
VISA ****8402
Thank you
`;

const LOU = `
Lou Malnati's
Chicago, USA
09/08/2026 12:40
Deep dish                  18.40
TOTAL                      18.40
`;

describe("extractionFromOcrText", () => {
  it("reads Union Hall fields and retrieves the catalog merchant", () => {
    const extraction = extractionFromOcrText(UNION_HALL);
    expect(extraction?.merchantName.value).toBe("Union Hall Coffee");
    expect(extraction?.transactionDate.value).toBe("2026-09-09");
    expect(extraction?.totalCents.value).toBe(1280);
    expect(extraction?.transactionTime?.value).toBe("16:30");
  });

  it("reads a noisy photo of Lou Malnati's from OCR text", () => {
    const extraction = extractionFromOcrText(`l0u malnati's\n${LOU}`);
    expect(extraction?.merchantName.value).toBe("Lou Malnati's");
    expect(extraction?.totalCents.value).toBe(1840);
    expect(extraction?.transactionDate.value).toBe("2026-09-08");
  });

  it("parses TOTAL rather than a line item", () => {
    expect(parseReceiptTotalCents("Espresso 6.58\nTOTAL 12.80")).toBe(1280);
  });
});

describe("createOcrExtractProvider", () => {
  it("prefills from recognized text when the file is not a known hash", async () => {
    const provider = createOcrExtractProvider({
      recognize: async () => UNION_HALL,
    });
    const result = await provider.extract({
      bytes: new Uint8Array(3000).fill(7),
      mimeType: "image/jpeg",
    });
    expect(result.fallback).toBe(false);
    expect(result.extraction?.merchantName.value).toBe("Union Hall Coffee");
    expect(result.extraction?.totalCents.value).toBe(1280);
  });

  it("falls back when recognition is empty", async () => {
    const result = await createOcrExtractProvider({
      recognize: async () => "",
    }).extract({ bytes: new Uint8Array(3000).fill(1), mimeType: "image/jpeg" });
    expect(result.fallback).toBe(true);
    expect(result.extraction).toBeNull();
  });
});
