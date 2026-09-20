"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { ReceiptUpload } from "@/components/employee/receipt-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ExpenseExtraction } from "@/contracts/employee";
import { EXPENSE_CATEGORIES } from "@/lib/employee/categories";
import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/employee/config";
import { isLowConfidence } from "@/lib/employee/corrected-fields";
import {
  centsToAmountInput,
  expenseFormSchema,
  type ExpenseFormValues,
} from "@/lib/employee/expense-schema";
import { cn } from "@/lib/utils";

type ExtractResponse = {
  fallback: boolean;
  extraction: ExpenseExtraction | null;
  error?: string;
};

export function ExpenseForm() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<ExpenseExtraction | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      merchantRaw: "",
      incurredOn: "",
      categoryId: "Meals",
      amount: "",
      description: "",
    },
  });

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function onReceipt(next: File | null) {
    setReceiptError(null);
    setFormError(null);
    setExtraction(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(next);
    setPreviewUrl(next ? URL.createObjectURL(next) : null);
    if (!next) return;

    setExtracting(true);
    try {
      const body = new FormData();
      body.set("receipt", next);
      const res = await fetch("/api/employee/expenses/extract", { method: "POST", body });
      const data = (await res.json()) as ExtractResponse;
      if (!res.ok) {
        setReceiptError(data.error ?? "We could not read this receipt. Enter the fields yourself.");
        return;
      }
      if (data.fallback || !data.extraction) {
        setReceiptError("We could not read this receipt. Enter the fields yourself.");
        return;
      }
      const extracted = data.extraction;
      setExtraction(extracted);
      if (extracted.merchantName.value) {
        form.setValue("merchantRaw", extracted.merchantName.value, { shouldValidate: true });
      }
      if (extracted.transactionDate.value) {
        form.setValue("incurredOn", extracted.transactionDate.value.slice(0, 10), {
          shouldValidate: true,
        });
      }
      if (Number.isInteger(extracted.totalCents.value) && extracted.totalCents.confidence >= 0.3) {
        form.setValue("amount", centsToAmountInput(extracted.totalCents.value), {
          shouldValidate: true,
        });
      }
    } catch {
      setReceiptError("We could not read this receipt. Enter the fields yourself.");
    } finally {
      setExtracting(false);
    }
  }

  async function onSubmit(values: ExpenseFormValues) {
    setFormError(null);
    if (!file) {
      setReceiptError("Attach a receipt image.");
      return;
    }
    setSubmitting(true);
    try {
      const body = new FormData();
      body.set("merchantRaw", values.merchantRaw);
      body.set("incurredOn", values.incurredOn);
      body.set("categoryId", values.categoryId);
      body.set("amount", values.amount);
      body.set("description", values.description);
      body.set("receipt", file);
      if (extraction) body.set("extraction", JSON.stringify(extraction));
      const res = await fetch("/api/employee/expenses", { method: "POST", body });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setFormError(data.error ?? "We could not submit this expense. Try again.");
        return;
      }
      setSubmittedId(data.id);
    } catch {
      setFormError("We could not submit this expense. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedId) {
    return (
      <div className="grid gap-4">
        <header>
          <h1 className="font-serif text-3xl font-medium">Expense submitted</h1>
          <p className="mt-1 text-xs text-ink-muted">It is on your record with status Submitted.</p>
        </header>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="min-h-10">
            <Link href="/employee">Back to my record</Link>
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="min-h-10"
            onClick={() => {
              form.reset();
              setSubmittedId(null);
              void onReceipt(null);
            }}
          >
            Submit another
          </Button>
        </div>
      </div>
    );
  }

  const errors = form.formState.errors;
  const merchantLow = isLowConfidence(
    extraction?.merchantName.confidence ?? 1,
    LOW_CONFIDENCE_THRESHOLD,
  );
  const dateLow = isLowConfidence(
    extraction?.transactionDate.confidence ?? 1,
    LOW_CONFIDENCE_THRESHOLD,
  );
  const amountLow = isLowConfidence(
    extraction?.totalCents.confidence ?? 1,
    LOW_CONFIDENCE_THRESHOLD,
  );

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="font-serif text-3xl font-medium">Submit an expense</h1>
        <p className="mt-1 text-xs text-ink-muted">
          Add a receipt, check the fields, and send. This usually takes a few minutes.
        </p>
      </header>

      <Card>
        <CardContent className="grid gap-4">
          <form className="grid gap-4" noValidate onSubmit={form.handleSubmit(onSubmit)}>
            <fieldset className="grid gap-2">
              <legend className="text-sm font-semibold">Receipt</legend>
              <ReceiptUpload
                file={file}
                previewUrl={previewUrl}
                extracting={extracting}
                error={receiptError}
                onFile={(next) => void onReceipt(next)}
              />
            </fieldset>

            <Field
              label="Merchant"
              htmlFor="merchantRaw"
              error={errors.merchantRaw?.message}
              lowConfidence={merchantLow}
            >
              <Input
                id="merchantRaw"
                className={cn("min-h-10", merchantLow && "border-copper")}
                autoComplete="off"
                aria-invalid={!!errors.merchantRaw}
                {...form.register("merchantRaw")}
              />
            </Field>

            <Field
              label="Date incurred"
              htmlFor="incurredOn"
              error={errors.incurredOn?.message}
              lowConfidence={dateLow}
            >
              <Input
                id="incurredOn"
                type="date"
                className={cn("min-h-10", dateLow && "border-copper")}
                aria-invalid={!!errors.incurredOn}
                {...form.register("incurredOn")}
              />
            </Field>

            <Field label="Category" htmlFor="categoryId" error={errors.categoryId?.message}>
              <select
                id="categoryId"
                className="min-h-10 w-full rounded-control border border-line-strong bg-surface px-3 text-sm text-ink"
                aria-invalid={!!errors.categoryId}
                {...form.register("categoryId")}
              >
                {EXPENSE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Amount"
              htmlFor="amount"
              hint="US dollars, for example 12.34"
              error={errors.amount?.message}
              lowConfidence={amountLow}
            >
              <Input
                id="amount"
                inputMode="decimal"
                placeholder="0.00"
                className={cn("min-h-10 tabular-nums", amountLow && "border-copper")}
                aria-invalid={!!errors.amount}
                {...form.register("amount")}
              />
            </Field>

            <Field
              label="Description"
              htmlFor="description"
              hint="Optional"
              error={errors.description?.message}
            >
              <textarea
                id="description"
                rows={3}
                className="w-full rounded-control border border-line-strong bg-surface px-3 py-2 text-sm text-ink"
                aria-invalid={!!errors.description}
                {...form.register("description")}
              />
            </Field>

            {formError ? (
              <p role="alert" className="text-xs text-error">
                {formError}
              </p>
            ) : null}

            <Button type="submit" className="min-h-10" disabled={submitting || extracting}>
              {submitting ? "Submitting" : "Submit expense"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  lowConfidence,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  lowConfidence?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {lowConfidence ? (
        <p className="text-xs text-copper-text">Low confidence. Check this field.</p>
      ) : null}
      {hint && !error ? <p className="text-xs text-ink-muted">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
