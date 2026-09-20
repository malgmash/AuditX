import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDocumentDetail, type FlagOnDocument, type ReceiptDetail, type TimesheetDetail } from "@/lib/admin/document-detail";
import { adminDataMode } from "@/lib/admin/repo";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Transaction" };
export const dynamic = "force-dynamic";

const LOW_CONFIDENCE = 0.8;

const dateFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const day = (iso: string) => dateFmt.format(new Date(iso));

function Confidence({ value }: { value: number }) {
  const low = value < LOW_CONFIDENCE;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono text-xs tabular-nums text-ink-muted">{Math.round(value * 100)}%</span>
      {low ? <Badge variant="held">Check this</Badge> : null}
    </span>
  );
}

function Flags({ flags }: { flags: FlagOnDocument[] }) {
  if (flags.length === 0) return <p className="text-sm text-ink-muted">Nothing has flagged this record.</p>;
  return (
    <ul>
      {flags.map((f) => (
        <li key={f.findingId} className="flex items-center gap-3 border-b border-line py-2 last:border-0">
          <Badge variant={f.severity === "IMMEDIATE_HOLD" ? "hold" : f.severity === "CASE" ? "case" : "note"}>
            {f.severity === "IMMEDIATE_HOLD" ? "Immediate hold" : f.severity === "CASE" ? "Case" : "Note"}
          </Badge>
          <span className="flex-1 font-mono text-xs">{f.ruleId}</span>
          {f.caseId ? (
            <Link href={`/admin/cases?case=${f.caseId}`} className="text-xs text-slate underline">
              Open the case
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-right text-sm">{children}</dd>
    </div>
  );
}

function Receipt({ d }: { d: ReceiptDetail }) {
  const x = d.extraction;
  return (
    <>
      <h1 className="mt-2 font-serif text-3xl font-medium">{d.merchant}</h1>
      <p className="mt-1 text-xs text-ink-muted">
        <Link href={`/admin/employees/${d.employee.id}`} className="text-slate hover:underline">
          {d.employee.name}
        </Link>
        , {d.employee.department}. Submitted {day(d.submittedAt)}.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="image-h" className="rounded-card border border-line bg-surface p-4">
          <h2 id="image-h" className="text-base font-semibold">
            Receipt image
          </h2>
          {d.imageUrl ? (
            // A signed link to a private bucket that expires in minutes, so next/image cannot cache or optimise it.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={d.imageUrl}
              alt={`Receipt from ${d.merchant} for ${formatCents(d.amountCents)} on ${day(d.incurredAt)}`}
              className="mt-3 max-h-[640px] w-full rounded-control border border-line object-contain"
            />
          ) : (
            <p className="mt-3 rounded-control border border-line p-6 text-sm text-ink-muted">
              {d.sha256 === null
                ? "No image was attached to this claim."
                : "The image cannot be shown right now. The claim details are on the right."}
            </p>
          )}
          {d.sha256 ? <p className="mt-2 break-all font-mono text-[11px] text-ink-muted">File fingerprint {d.sha256}</p> : null}
        </section>

        <section aria-labelledby="fields-h" className="rounded-card border border-line bg-surface p-4">
          <h2 id="fields-h" className="text-base font-semibold">
            What was read from the receipt
          </h2>
          {x ? (
            <dl className="mt-2">
              <Field label="Merchant">
                <span className="mr-3">{x.merchantName.value}</span>
                <Confidence value={x.merchantName.confidence} />
              </Field>
              <Field label="Date">
                <span className="mr-3 tabular-nums">{x.transactionDate.value}</span>
                <Confidence value={x.transactionDate.confidence} />
              </Field>
              <Field label="Total">
                <span className="mr-3 tabular-nums">{formatCents(x.totalCents.value)}</span>
                <Confidence value={x.totalCents.confidence} />
              </Field>
              {x.merchantCity ? (
                <Field label="City">
                  <span className="mr-3">{x.merchantCity.value}</span>
                  <Confidence value={x.merchantCity.confidence} />
                </Field>
              ) : null}
              {x.transactionTime?.value ? (
                <Field label="Time">
                  <span className="mr-3 tabular-nums">{x.transactionTime.value}</span>
                  <Confidence value={x.transactionTime.confidence} />
                </Field>
              ) : null}
              <Field label="How legible the image is">
                <span className="tabular-nums">{Math.round(x.legibility * 100)}%</span>
              </Field>
            </dl>
          ) : (
            <p className="mt-2 text-sm text-ink-muted">Nothing was read from this receipt.</p>
          )}

          <h2 className="mt-6 text-base font-semibold">The claim</h2>
          <dl className="mt-2">
            <Field label="Amount claimed">
              <span className="tabular-nums">{formatCents(d.amountCents)}</span>
              {x && x.totalCents.value !== d.amountCents ? (
                <span className="ml-2 text-xs text-copper-text">differs from the receipt</span>
              ) : null}
            </Field>
            <Field label="Date of purchase">{day(d.incurredAt)}</Field>
            <Field label="Category">{d.category}</Field>
            <Field label="Status">
              <Badge variant={d.status === "HELD" ? "hold" : d.status === "SUBMITTED" ? "held" : "cleared"}>
                {d.status === "HELD" ? "Held" : d.status.charAt(0) + d.status.slice(1).toLowerCase()}
              </Badge>
            </Field>
            {d.description ? <Field label="Description">{d.description}</Field> : null}
          </dl>
        </section>
      </div>

      <section className="mt-4 rounded-card border border-line bg-surface p-4">
        <h2 className="text-base font-semibold">Flags on this record</h2>
        <div className="mt-2">
          <Flags flags={d.flags} />
        </div>
      </section>
    </>
  );
}

function Timesheet({ d }: { d: TimesheetDetail }) {
  return (
    <>
      <h1 className="mt-2 font-serif text-3xl font-medium">Timesheet, week of {day(d.weekStart)}</h1>
      <p className="mt-1 text-xs text-ink-muted">
        <Link href={`/admin/employees/${d.employee.id}`} className="text-slate hover:underline">
          {d.employee.name}
        </Link>
        , {d.employee.department}. Submitted {day(d.submittedAt)}. {d.totalHours} hours in total.
      </p>

      <div className="mt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Day</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {d.days.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-ink-muted">
                  This timesheet has no entries.
                </TableCell>
              </TableRow>
            ) : (
              d.days.flatMap((dayRow) =>
                dayRow.entries.map((e, i) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap">{i === 0 ? day(dayRow.date) : ""}</TableCell>
                    <TableCell className="tabular-nums">{e.start ?? ""}</TableCell>
                    <TableCell className="tabular-nums">{e.end ?? ""}</TableCell>
                    <TableCell className="text-right tabular-nums">{e.hours}</TableCell>
                    <TableCell>{e.project ?? ""}</TableCell>
                    <TableCell>{e.location ?? ""}</TableCell>
                    <TableCell className="text-ink-muted">{e.note ?? ""}</TableCell>
                  </TableRow>
                )),
              )
            )}
          </TableBody>
        </Table>
      </div>

      <section className="mt-4 rounded-card border border-line bg-surface p-4">
        <h2 className="text-base font-semibold">Flags on this record</h2>
        <div className="mt-2">
          <Flags flags={d.flags} />
        </div>
      </section>
    </>
  );
}

export default async function TransactionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // The detail view reads the receipt image and its extracted fields, which only exist in the database.
  const detail = adminDataMode() === "db" ? await getDocumentDetail(id) : null;
  if (!detail) notFound();

  return (
    <>
      <Link href="/admin/transactions" className="text-xs text-slate underline">
        Back to transactions
      </Link>
      {detail.kind === "RECEIPT" ? <Receipt d={detail} /> : <Timesheet d={detail} />}
    </>
  );
}
