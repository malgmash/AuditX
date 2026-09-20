import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  createLiveExtractProvider,
  createMockExtractProvider,
  getExtractProvider,
  modelFieldsToExtraction,
} from "./extract";
import { sha256Hex } from "./receipt-file";

const bytes = new Uint8Array([1, 2, 3, 4]);

describe("mock extract provider", () => {
  it("returns fixture fields and a deterministic hash", async () => {
    const first = await createMockExtractProvider().extract({ bytes, mimeType: "image/jpeg" });
    const second = await createMockExtractProvider().extract({ bytes, mimeType: "image/jpeg" });
    expect(first.fallback).toBe(false);
    expect(first.extraction?.merchantName.value).toBe("Union Hall Coffee");
    expect(first.extraction?.totalCents.value).toBe(1280);
    expect(first.phash).toHaveLength(64);
    expect(first.phash).toBe(second.phash);
    expect(first.phash).not.toBe(sha256Hex(bytes));
  });

  it("reads the Union Hall sample receipt from its image bytes", async () => {
    const image = readFileSync("../analysis/data/samples/receipts/union-hall-coffee.jpg");
    const result = await createMockExtractProvider().extract({
      bytes: new Uint8Array(image),
      mimeType: "image/jpeg",
    });
    expect(result.extraction?.merchantName.value).toBe("Union Hall Coffee");
    expect(result.extraction?.totalCents.value).toBe(1280);
    expect(result.extraction?.transactionDate.value).toBe("2026-09-09");
  });
});

describe("modelFieldsToExtraction", () => {
  it("reads total_cents and a US date", () => {
    const extraction = modelFieldsToExtraction({
      merchant_name: "Lou Malnati's",
      merchant_city: "Chicago",
      transaction_date: "09/08/2026",
      transaction_time: "12:40",
      total_cents: 1840,
      field_confidence: { merchant_name: 0.9, transaction_date: 0.9, total: 0.95 },
      legibility: 0.9,
    });
    expect(extraction?.merchantName.value).toBe("Lou Malnati's");
    expect(extraction?.transactionDate.value).toBe("2026-09-08");
    expect(extraction?.totalCents.value).toBe(1840);
  });
});

describe("getExtractProvider", () => {
  it("prefills Lou Malnati's from the receipt catalog", async () => {
    const image = readFileSync("../analysis/data/samples/receipts/lou-malnatis.jpg");
    const result = await getExtractProvider().extract({
      bytes: new Uint8Array(image),
      mimeType: "image/jpeg",
    });
    expect(result.fallback).toBe(false);
    expect(result.extraction?.merchantName.value).toBe("Lou Malnati's");
    expect(result.extraction?.totalCents.value).toBe(1840);
    expect(result.extraction?.transactionDate.value).toBe("2026-09-08");
  });

  it("does not invent fields for an unknown image", async () => {
    const result = await getExtractProvider().extract({
      bytes: new Uint8Array([1, 2, 3, 4, 5]),
      mimeType: "image/jpeg",
    });
    expect(result.fallback).toBe(true);
    expect(result.extraction).toBeNull();
  });
});

describe("live extract provider", () => {
  it("falls back when the analysis service is unreachable", async () => {
    const provider = createLiveExtractProvider({
      baseUrl: "http://127.0.0.1:9",
      fetchImpl: async () => {
        throw new Error("ECONNREFUSED");
      },
    });
    const result = await provider.extract({ bytes, mimeType: "image/jpeg" });
    expect(result.fallback).toBe(true);
    expect(result.extraction).toBeNull();
  });

  it("falls back on a non-OK response", async () => {
    const provider = createLiveExtractProvider({
      baseUrl: "http://analysis.test",
      fetchImpl: async () => new Response("no", { status: 503 }),
    });
    const result = await provider.extract({ bytes, mimeType: "image/jpeg" });
    expect(result.fallback).toBe(true);
    expect(result.extraction).toBeNull();
  });
});
