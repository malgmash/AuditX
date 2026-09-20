import { HttpError } from "@/lib/auth/http";
import type { ExpenseExtraction, OwnExpense, OwnReceipt } from "@/contracts/employee";
import { resolveActingUserId } from "@/lib/employee/acting-user";
import { diffCorrectedFields } from "@/lib/employee/corrected-fields";
import {
  expenseFormSchema,
  incurredOnToIso,
  parseAmountCents,
  parseExtractionPayload,
} from "@/lib/employee/expense-schema";
import { getExtractProvider, type ExtractProvider } from "@/lib/employee/extract";
import {
  isReceiptImage,
  memoryReceiptStorage,
  newReceiptId,
  placeholderPhash,
  receiptStorageKey,
  receiptTooLarge,
  sha256Hex,
  type ReceiptStorage,
} from "@/lib/employee/receipt-file";
import { getEmployeeRepo } from "@/lib/employee/repo";
import type { SessionUser } from "@/lib/auth/session";
import type { EmployeeRepository } from "@/contracts/employee";

export type SubmitExpenseResult = {
  expense: OwnExpense;
  fallback: boolean;
};

function notifyAnalysis(): void {
  const baseUrl = process.env.ANALYSIS_URL;
  if (!baseUrl || process.env.AUDITX_DATA === "fixtures") return;
  const token = process.env.INTERNAL_TOKEN ?? "dev-internal-token";
  void fetch(`${baseUrl.replace(/\/$/, "")}/internal/detect`, {
    method: "POST",
    headers: { "X-Internal-Token": token },
    signal: AbortSignal.timeout(3000),
  }).catch(() => undefined);
}

export async function extractReceiptImage(
  file: File,
  provider: ExtractProvider = getExtractProvider(),
) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return provider.extract({ bytes, mimeType: file.type || "application/octet-stream" });
}

export async function submitEmployeeExpense(opts: {
  user: SessionUser;
  form: FormData;
  repo?: EmployeeRepository;
  extract?: ExtractProvider;
  storage?: ReceiptStorage;
}): Promise<SubmitExpenseResult> {
  const actingUserId = resolveActingUserId(opts.user);
  const fields = expenseFormSchema.safeParse({
    merchantRaw: String(opts.form.get("merchantRaw") ?? ""),
    incurredOn: String(opts.form.get("incurredOn") ?? ""),
    categoryId: String(opts.form.get("categoryId") ?? ""),
    amount: String(opts.form.get("amount") ?? ""),
    description: String(opts.form.get("description") ?? ""),
  });
  if (!fields.success) {
    const first = fields.error.issues[0]?.message ?? "Check the expense fields.";
    throw new HttpError(422, first);
  }

  const amountCents = parseAmountCents(fields.data.amount);
  if (amountCents === null || amountCents <= 0) {
    throw new HttpError(422, "Enter an amount with up to two decimal places, for example 12.34.");
  }

  const receipt = opts.form.get("receipt");
  if (!(receipt instanceof File) || receipt.size === 0) {
    throw new HttpError(422, "Attach a receipt image.");
  }
  if (!isReceiptImage(receipt)) {
    throw new HttpError(422, "The receipt must be an image.");
  }
  if (receiptTooLarge(receipt.size)) {
    throw new HttpError(422, "That image is too large. Use a file under 8 MB.");
  }

  const bytes = new Uint8Array(await receipt.arrayBuffer());
  const sha256 = sha256Hex(bytes);
  const mimeType = receipt.type || "image/jpeg";
  const receiptId = newReceiptId();
  const storageKey = receiptStorageKey(actingUserId, receiptId, mimeType);
  const storage = opts.storage ?? memoryReceiptStorage;
  await storage.put(storageKey, bytes, mimeType);

  let extraction = parseExtractionPayload(parseJsonField(opts.form.get("extraction")));
  let fallback = false;
  let phash = placeholderPhash(sha256);
  if (!extraction) {
    const extracted = await (opts.extract ?? getExtractProvider()).extract({ bytes, mimeType });
    fallback = extracted.fallback;
    extraction = extracted.extraction;
    phash = extracted.phash;
  }

  const corrected = diffCorrectedFields(extraction, {
    merchantRaw: fields.data.merchantRaw,
    incurredOn: fields.data.incurredOn,
    amountCents,
  });
  const storedExtraction: ExpenseExtraction | null = extraction
    ? { ...extraction, correctedFields: corrected }
    : null;

  const ownReceipt: OwnReceipt = {
    id: receiptId,
    storageKey,
    mimeType,
    sha256,
    phash,
  };

  const repo = opts.repo ?? getEmployeeRepo();
  const expense = await repo.createExpense(actingUserId, {
    incurredAt: incurredOnToIso(fields.data.incurredOn),
    merchantRaw: fields.data.merchantRaw,
    categoryId: fields.data.categoryId,
    amountCents,
    description: fields.data.description,
    receipt: ownReceipt,
    extraction: storedExtraction,
  });

  notifyAnalysis();
  return { expense, fallback };
}

function parseJsonField(value: FormDataEntryValue | null): unknown {
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
