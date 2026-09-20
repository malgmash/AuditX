import type { ExpenseExtraction } from "@/contracts/employee";
import { expenses } from "@/fixtures/employee/data";
import { SAMPLE_RECEIPT_EXTRACTIONS } from "@/fixtures/employee/sample-receipts";
import { dollarsToCents } from "@/lib/money";
import { createOcrExtractProvider } from "@/lib/employee/ocr-extract";
import { placeholderPhash, sha256Hex } from "@/lib/employee/receipt-file";

export type ExtractInput = {
  bytes: Uint8Array;
  mimeType: string;
};

export type ExtractResult = {
  fallback: boolean;
  extraction: ExpenseExtraction | null;
  phash: string;
};

export type ExtractProvider = {
  extract(input: ExtractInput): Promise<ExtractResult>;
};

const DEFAULT_EXTRACTION: ExpenseExtraction = {
  merchantName: { value: "Union Hall Coffee", confidence: 0.95 },
  transactionDate: { value: "2026-09-09", confidence: 0.62 },
  totalCents: { value: 1280, confidence: 0.97 },
  merchantCity: { value: "Pittsburgh", confidence: 0.88 },
  transactionTime: { value: "16:30", confidence: 0.8 },
  legibility: 0.9,
  correctedFields: [],
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function confidenceMap(value: unknown): Record<string, number> {
  const record = asRecord(value);
  if (!record) return {};
  const out: Record<string, number> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry === "number" && Number.isFinite(entry)) out[key] = entry;
  }
  return out;
}

function normalizeDate(value: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) return value;
  const us = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (us) return `${us[3]}-${us[1]}-${us[2]}`;
  return value;
}

function totalToCents(record: Record<string, unknown>): number | null {
  if (typeof record.total_cents === "number" && Number.isInteger(record.total_cents) && record.total_cents >= 0) {
    return record.total_cents;
  }
  if (typeof record.total_cents === "string") return dollarsToCents(record.total_cents);
  if (typeof record.total === "number" && Number.isInteger(record.total) && record.total >= 0) {
    return record.total;
  }
  if (typeof record.total === "string") return dollarsToCents(record.total);
  if (typeof record.total === "number" && Number.isFinite(record.total) && record.total >= 0) {
    return dollarsToCents(String(record.total));
  }
  return null;
}

export function modelFieldsToExtraction(body: unknown): ExpenseExtraction | null {
  const record = asRecord(body);
  if (!record) return null;
  const conf = confidenceMap(record.field_confidence);
  const merchant = typeof record.merchant_name === "string" ? record.merchant_name : "";
  const rawDate = typeof record.transaction_date === "string" ? record.transaction_date : "";
  const date = rawDate ? normalizeDate(rawDate) : "";
  const totalCents = totalToCents(record);
  if (!merchant && !date && totalCents === null) return null;
  const city = typeof record.merchant_city === "string" ? record.merchant_city : null;
  const time = typeof record.transaction_time === "string" ? record.transaction_time : null;
  const legibility = typeof record.legibility === "number" ? record.legibility : 0;
  return {
    merchantName: { value: merchant, confidence: conf.merchant_name ?? (merchant ? 0.7 : 0) },
    transactionDate: { value: date, confidence: conf.transaction_date ?? (date ? 0.7 : 0) },
    totalCents: { value: totalCents ?? 0, confidence: conf.total ?? conf.total_cents ?? (totalCents === null ? 0 : 0.7) },
    merchantCity: city ? { value: city, confidence: conf.merchant_city ?? 0.7 } : null,
    transactionTime: time ? { value: time, confidence: conf.transaction_time ?? 0.7 } : null,
    legibility,
    correctedFields: [],
  };
}

function fromKnownImage(sha256: string): ExpenseExtraction | null {
  const sample = SAMPLE_RECEIPT_EXTRACTIONS[sha256];
  if (sample) return structuredClone(sample);
  const match = expenses.find((row) => row.receipt?.sha256 === sha256);
  return match?.extraction ? structuredClone(match.extraction) : null;
}

export function createMockExtractProvider(): ExtractProvider {
  return {
    async extract(input) {
      const sha256 = sha256Hex(input.bytes);
      return {
        fallback: false,
        extraction: fromKnownImage(sha256) ?? structuredClone(DEFAULT_EXTRACTION),
        phash: placeholderPhash(sha256),
      };
    },
  };
}

export function createLiveExtractProvider(opts?: {
  baseUrl?: string;
  token?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): ExtractProvider {
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const timeoutMs = opts?.timeoutMs ?? 8000;
  return {
    async extract(input) {
      const sha256 = sha256Hex(input.bytes);
      const phash = placeholderPhash(sha256);
      const baseUrl = opts?.baseUrl ?? process.env.ANALYSIS_URL;
      const token = opts?.token ?? process.env.INTERNAL_TOKEN ?? "dev-internal-token";
      if (!baseUrl) {
        return { fallback: true, extraction: null, phash };
      }
      try {
        const body = new FormData();
        body.set(
          "file",
          new File([Buffer.from(input.bytes)], "receipt", {
            type: input.mimeType || "application/octet-stream",
          }),
        );
        const res = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/internal/extract`, {
          method: "POST",
          headers: { "X-Internal-Token": token },
          body,
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) {
          return { fallback: true, extraction: null, phash };
        }
        const json: unknown = await res.json();
        const extraction = modelFieldsToExtraction(json);
        if (!extraction) return { fallback: true, extraction: null, phash };
        return { fallback: false, extraction, phash };
      } catch {
        return { fallback: true, extraction: null, phash };
      }
    },
  };
}

export function getExtractProvider(): ExtractProvider {
  return {
    async extract(input) {
      const sha256 = sha256Hex(input.bytes);
      const phash = placeholderPhash(sha256);
      const known = fromKnownImage(sha256);
      if (known) return { fallback: false, extraction: known, phash };
      if (process.env.AUDITX_EXTRACT === "live") {
        return createLiveExtractProvider().extract(input);
      }
      return createOcrExtractProvider().extract(input);
    },
  };
}
