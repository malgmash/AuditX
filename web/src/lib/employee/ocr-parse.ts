import type { ExpenseExtraction } from "@/contracts/employee";
import { receiptCatalog, type ReceiptCatalogEntry } from "@/fixtures/employee/receipt-catalog";
import { dollarsToCents } from "@/lib/money";

const DATE_US = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/;
const DATE_ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/;
const TIME = /\b([01]?\d|2[0-3]):([0-5]\d)\b/;
const MONEY = /\$?\s*(\d{1,3}(?:,\d{3})*|\d+)\.(\d{2})\b/g;
const MONEY_LINE = /\$?\s*(\d{1,3}(?:,\d{3})*|\d+)\.(\d{2})\b/;
const SKIP_MERCHANT =
  /^(store|reg|order|subtotal|total|visa|mastercard|amex|thank|tel|phone|www|http|#)/i;

function tokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((part) => part.length > 2),
  );
}

function pad2(value: string): string {
  return value.padStart(2, "0");
}

export function parseReceiptDate(text: string): string | null {
  const iso = DATE_ISO.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = DATE_US.exec(text);
  if (!us) return null;
  return `${us[3]}-${pad2(us[1])}-${pad2(us[2])}`;
}

export function parseReceiptTime(text: string): string | null {
  const match = TIME.exec(text);
  if (!match) return null;
  return `${pad2(match[1])}:${match[2]}`;
}

export function parseReceiptTotalCents(text: string): number | null {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    if (!/\btotal\b/i.test(line) || /\bsubtotal\b/i.test(line)) continue;
    MONEY.lastIndex = 0;
    const money = MONEY.exec(line);
    if (!money) continue;
    const cents = dollarsToCents(`${money[1].replace(/,/g, "")}.${money[2]}`);
    if (cents !== null && cents > 0) return cents;
  }
  const amounts: number[] = [];
  MONEY.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MONEY.exec(text))) {
    const cents = dollarsToCents(`${match[1].replace(/,/g, "")}.${match[2]}`);
    if (cents !== null && cents > 0) amounts.push(cents);
  }
  return amounts.length ? amounts[amounts.length - 1]! : null;
}

export function parseReceiptMerchant(text: string): string | null {
  for (const line of text.split(/\r?\n/).map((row) => row.trim()).filter(Boolean)) {
    if (SKIP_MERCHANT.test(line)) continue;
    if (DATE_US.test(line) || DATE_ISO.test(line)) continue;
    if (MONEY_LINE.test(line) && line.length < 24) continue;
    const cleaned = line.replace(/[^A-Za-z0-9'&.\-\s]/g, " ").replace(/\s+/g, " ").trim();
    if (cleaned.length < 3) continue;
    return cleaned;
  }
  return null;
}

export function retrieveReceiptCatalog(text: string): ReceiptCatalogEntry | null {
  const haystack = text.toLowerCase();
  const query = tokens(text);
  let best: { entry: ReceiptCatalogEntry; score: number } | null = null;
  for (const entry of receiptCatalog()) {
    const merchant = entry.merchant.toLowerCase();
    const merchantTokens = tokens(entry.merchant);
    let score = 0;
    if (merchant.length >= 4 && haystack.includes(merchant)) score += 3;
    if (merchantTokens.size) {
      let hit = 0;
      for (const token of merchantTokens) {
        if (query.has(token) || haystack.includes(token)) hit += 1;
      }
      score += hit / merchantTokens.size;
    }
    if (!best || score > best.score) best = { entry, score };
  }
  if (!best || best.score < 1.4) return null;
  return best.entry;
}

export function extractionFromOcrText(text: string): ExpenseExtraction | null {
  const cleaned = text.replace(/\u0000/g, " ").trim();
  if (!cleaned) return null;
  const retrieved = retrieveReceiptCatalog(cleaned);
  const merchant = retrieved?.extraction.merchantName.value ?? parseReceiptMerchant(cleaned) ?? "";
  const date = parseReceiptDate(cleaned) ?? retrieved?.extraction.transactionDate.value ?? "";
  const totalCents =
    parseReceiptTotalCents(cleaned) ?? retrieved?.extraction.totalCents.value ?? null;
  if (!merchant && !date && totalCents === null) return null;
  const city =
    retrieved?.extraction.merchantCity?.value ??
    (/\bpittsburgh\b/i.test(cleaned) ? "Pittsburgh" : /\bchicago\b/i.test(cleaned) ? "Chicago" : null);
  const time = parseReceiptTime(cleaned) ?? retrieved?.extraction.transactionTime?.value ?? null;
  const merchantConf = retrieved ? 0.92 : merchant ? 0.62 : 0;
  const dateConf = parseReceiptDate(cleaned) ? 0.86 : retrieved ? 0.55 : 0;
  const totalConf = parseReceiptTotalCents(cleaned) ? 0.88 : retrieved ? 0.55 : 0;
  return {
    merchantName: { value: merchant, confidence: merchantConf },
    transactionDate: { value: date, confidence: dateConf },
    totalCents: { value: totalCents ?? 0, confidence: totalCents === null ? 0 : totalConf },
    merchantCity: city ? { value: city, confidence: retrieved ? 0.85 : 0.55 } : null,
    transactionTime: time ? { value: time, confidence: 0.7 } : null,
    legibility: retrieved ? 0.82 : 0.58,
    correctedFields: [],
  };
}
