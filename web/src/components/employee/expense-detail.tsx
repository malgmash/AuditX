import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusHistory } from "@/components/employee/status-history";
import type { ExtractionFieldName, OwnExpense } from "@/contracts/employee";
import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/employee/config";
import { expenseStatusBadgeVariant } from "@/lib/employee/expense-status";
import { expenseStatusLabel } from "@/lib/employee/overview";
import { formatCents } from "@/lib/money";

const dayFmt = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const FIELD_LABELS: Record<ExtractionFieldName, string> = {
  merchantName: "Merchant",
  transactionDate: "Date on the receipt",
  totalCents: "Total on the receipt",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function ExtractedRows({ expense }: { expense: OwnExpense }) {
  const extraction = expense.extraction;
  if (!extraction) {
    return (
      <p className="max-w-[72ch] text-sm text-ink-muted">
        This expense was typed in without a scan, so there are no read-back fields.
      </p>
    );
  }

  const fields: Array<{ name: ExtractionFieldName; value: string; confidence: number }> = [
    {
      name: "merchantName",
      value: extraction.merchantName.value,
      confidence: extraction.merchantName.confidence,
    },
    {
      name: "transactionDate",
      value: extraction.transactionDate.value,
      confidence: extraction.transactionDate.confidence,
    },
    {
      name: "totalCents",
      value: formatCents(extraction.totalCents.value),
      confidence: extraction.totalCents.confidence,
    },
  ];

  return (
    <div className="grid gap-4">
      <dl className="grid gap-4 sm:grid-cols-3">
        {fields.map((field) => (
          <Row key={field.name} label={FIELD_LABELS[field.name]}>
            <span className="tabular-nums">{field.value}</span>
            {field.confidence <= LOW_CONFIDENCE_THRESHOLD ? (
              <span className="mt-1 block text-xs text-copper-text">Read with low confidence.</span>
            ) : null}
            {extraction.correctedFields.includes(field.name) ? (
              <span className="mt-1 block text-xs text-ink-muted">You corrected this.</span>
            ) : null}
          </Row>
        ))}
      </dl>
      {extraction.merchantCity ? (
        <p className="text-xs text-ink-muted">City on the receipt: {extraction.merchantCity.value}</p>
      ) : null}
    </div>
  );
}

export function ExpenseDetailView({
  expense,
  receiptUrl,
}: {
  expense: OwnExpense;
  receiptUrl: string | null;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid gap-4">
        <Card>
          <CardHeader className="px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>What you submitted</CardTitle>
              <Badge variant={expenseStatusBadgeVariant(expense.status)}>
                {expenseStatusLabel(expense.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-3xl font-semibold tabular-nums">{formatCents(expense.amountCents)}</p>
            <dl className="grid gap-4 sm:grid-cols-3">
              <Row label="Merchant">{expense.merchantRaw}</Row>
              <Row label="Date incurred">
                <span className="tabular-nums">{dayFmt.format(new Date(expense.incurredAt))}</span>
              </Row>
              <Row label="Category">{expense.categoryId}</Row>
            </dl>
            {expense.description ? (
              <Row label="Description">
                <span className="block max-w-[72ch]">{expense.description}</span>
              </Row>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-6">
            <CardTitle>Read from the image</CardTitle>
          </CardHeader>
          <CardContent>
            <ExtractedRows expense={expense} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-6">
            <CardTitle>Status history</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusHistory history={expense.statusHistory} labelFor={expenseStatusLabel} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="px-6">
          <CardTitle>Receipt</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {receiptUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={receiptUrl}
              alt={`Receipt from ${expense.merchantRaw}`}
              className="w-full rounded-card border border-line bg-bone object-contain"
            />
          ) : expense.receipt ? (
            <p className="max-w-[72ch] text-sm text-ink-muted">
              The image is not available to view here. Its fingerprint is below, so a reviewer can
              still find it.
            </p>
          ) : (
            <p className="text-sm text-ink-muted">No receipt image was attached.</p>
          )}
          {expense.receipt ? (
            <dl className="grid gap-2">
              <Row label="File type">{expense.receipt.mimeType}</Row>
              <Row label="Image fingerprint">
                <span className="block break-all font-mono text-xs">{expense.receipt.sha256}</span>
              </Row>
            </dl>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
