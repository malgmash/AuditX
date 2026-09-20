import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export function KpiCard({
  label,
  value,
  icon,
  copper,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  copper?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 px-4 py-4">
        <div>
          <p className="text-xs text-ink-muted">{label}</p>
          <p
            className={
              copper
                ? "mt-1 text-2xl font-semibold tabular-nums text-copper"
                : "mt-1 text-2xl font-semibold tabular-nums"
            }
          >
            {value}
          </p>
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-slate-tint text-slate">
          {icon}
        </span>
      </CardContent>
    </Card>
  );
}
