import { z } from "zod";
import { EXPENSE_CATEGORIES } from "@/lib/employee/categories";
import { dollarsToCents } from "@/lib/money";

export const expenseFormSchema = z.object({
  merchantRaw: z.string().trim().min(1, "Enter the merchant name.").max(200),
  incurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date incurred."),
  categoryId: z.enum(EXPENSE_CATEGORIES, { message: "Choose a category." }),
  amount: z.string().min(1, "Enter the amount."),
  description: z.string().trim().max(500),
});

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

export const extractionPayloadSchema = z.object({
  merchantName: z.object({ value: z.string(), confidence: z.number() }),
  transactionDate: z.object({ value: z.string(), confidence: z.number() }),
  totalCents: z.object({ value: z.number().int(), confidence: z.number() }),
  merchantCity: z.object({ value: z.string(), confidence: z.number() }).nullable(),
  transactionTime: z
    .object({ value: z.string().nullable(), confidence: z.number() })
    .nullable(),
  legibility: z.number(),
  correctedFields: z.array(z.enum(["merchantName", "transactionDate", "totalCents"])),
});

export function parseAmountCents(amount: string): number | null {
  return dollarsToCents(amount);
}

/** Format integer cents for an amount input, without a currency sign. */
export function centsToAmountInput(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Error("centsToAmountInput expects non-negative integer cents");
  }
  const whole = Math.trunc(cents / 100);
  const frac = cents % 100;
  return `${whole}.${String(frac).padStart(2, "0")}`;
}

export function incurredOnToIso(incurredOn: string): string {
  return `${incurredOn}T12:00:00.000Z`;
}

export function parseExtractionPayload(raw: unknown) {
  const parsed = extractionPayloadSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
