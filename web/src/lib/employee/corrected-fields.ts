import type { ExpenseExtraction, ExtractionFieldName } from "@/contracts/employee";

export function diffCorrectedFields(
  extraction: ExpenseExtraction | null,
  values: { merchantRaw: string; incurredOn: string; amountCents: number },
): ExtractionFieldName[] {
  if (!extraction) return [];
  const fields: ExtractionFieldName[] = [];
  if (extraction.merchantName.value !== values.merchantRaw) fields.push("merchantName");
  if (extraction.transactionDate.value !== values.incurredOn) fields.push("transactionDate");
  if (extraction.totalCents.value !== values.amountCents) fields.push("totalCents");
  return fields;
}

export function isLowConfidence(confidence: number, threshold: number): boolean {
  return confidence < threshold;
}
