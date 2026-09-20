import { Badge } from "@/components/ui/badge";
import type { OwnHold } from "@/contracts/employee";
import { formatCents } from "@/lib/money";

export type HoldItem = {
  hold: OwnHold;
  amountCents: number | null;
};

export function HoldsPanel({ items }: { items: HoldItem[] }) {
  if (items.length === 0) {
    return (
      <section
        aria-labelledby="held-heading"
        className="rounded-card border border-line bg-surface px-6 py-5"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="held-heading" className="font-serif text-xl font-medium leading-7">
            Paused reimbursements
          </h2>
          <p className="text-sm text-ink-muted">Nothing is paused</p>
        </div>
        <p className="mt-2 max-w-[72ch] text-xs leading-4 text-ink-muted">
          New flags will appear here with a plain reason and what happens next.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="held-heading" className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="held-heading" className="font-serif text-xl font-medium leading-7">
          Paused reimbursements
        </h2>
        <p className="text-xs text-ink-muted tabular-nums">
          {items.length} {items.length === 1 ? "item" : "items"} waiting on review
        </p>
      </div>
      <ul className="grid gap-4">
        {items.map(({ hold, amountCents }) => (
          <li key={hold.id}>
            <article className="rounded-card border border-line bg-surface p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-base font-semibold leading-6">Reimbursement paused</h3>
                    <Badge variant="held">Held</Badge>
                  </div>
                  {amountCents !== null ? (
                    <p className="mt-3 text-3xl font-semibold tabular-nums text-copper">
                      {formatCents(amountCents)}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 grid gap-3 border-t border-line pt-4">
                <div>
                  <p className="text-xs font-semibold text-ink-muted">Why it is paused</p>
                  <p className="mt-1 max-w-[72ch] text-sm leading-5">{hold.reason}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink-muted">What happens next</p>
                  <p className="mt-1 max-w-[72ch] text-sm leading-5 text-ink-muted">{hold.nextStep}</p>
                </div>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
