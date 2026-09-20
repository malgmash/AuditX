import type { ExpenseExtraction } from "@/contracts/employee";
import { expenses } from "@/fixtures/employee/data";
import { SAMPLE_RECEIPT_EXTRACTIONS } from "@/fixtures/employee/sample-receipts";

export type ReceiptCatalogEntry = {
  merchant: string;
  searchText: string;
  extraction: ExpenseExtraction;
};

function searchText(extraction: ExpenseExtraction): string {
  return [
    extraction.merchantName.value,
    extraction.merchantCity?.value ?? "",
    extraction.transactionDate.value,
    extraction.transactionTime?.value ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

export function receiptCatalog(): ReceiptCatalogEntry[] {
  const seen = new Set<string>();
  const rows: ReceiptCatalogEntry[] = [];
  function add(extraction: ExpenseExtraction) {
    const merchant = extraction.merchantName.value.trim();
    if (!merchant || seen.has(merchant.toLowerCase())) return;
    seen.add(merchant.toLowerCase());
    rows.push({
      merchant,
      searchText: searchText(extraction),
      extraction: structuredClone(extraction),
    });
  }
  for (const extraction of Object.values(SAMPLE_RECEIPT_EXTRACTIONS)) add(extraction);
  for (const row of expenses) {
    if (row.extraction) add(row.extraction);
  }
  return rows;
}
