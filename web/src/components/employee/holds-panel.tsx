import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OwnHold } from "@/contracts/employee";
import { formatCents } from "@/lib/money";

export type HoldItem = {
  hold: OwnHold;
  amountCents: number | null;
};

export function HoldsPanel({ items }: { items: HoldItem[] }) {
  return (
    <section aria-labelledby="held-heading">
      <h2 id="held-heading" className="font-serif text-xl font-medium">
        Paused reimbursements
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 max-w-[72ch] text-sm text-ink-muted">
          Nothing is paused. New flags will appear here.
        </p>
      ) : (
        <ul className="mt-4 grid gap-4">
          {items.map(({ hold, amountCents }) => (
            <li key={hold.id}>
              <Card>
                <CardHeader className="px-6">
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle>Reimbursement paused</CardTitle>
                    <Badge variant="held">Held</Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {amountCents !== null ? (
                    <p className="text-2xl font-semibold tabular-nums text-copper">
                      {formatCents(amountCents)}
                    </p>
                  ) : null}
                  <p className="max-w-[72ch] text-sm">{hold.reason}</p>
                  <p className="max-w-[72ch] text-xs text-ink-muted">{hold.nextStep}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
