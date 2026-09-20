import Link from "next/link";
import {
  SUBMISSION_STATUS_FILTERS,
  SUBMISSION_TYPE_FILTERS,
  submissionsHref,
  type SubmissionFilters,
} from "@/lib/employee/submissions";
import { cn } from "@/lib/utils";

type Option<T> = { value: T; label: string };

function FilterGroup<T extends string>({
  label,
  options,
  current,
  hrefFor,
}: {
  label: string;
  options: Option<T>[];
  current: T;
  hrefFor: (value: T) => string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-ink-muted">{label}</span>
      {options.map((option) => {
        const selected = option.value === current;
        return (
          <Link
            key={option.value}
            href={hrefFor(option.value)}
            aria-current={selected ? "true" : undefined}
            className={cn(
              "inline-flex min-h-10 items-center rounded-control border px-3 text-sm",
              selected
                ? "border-transparent bg-slate-tint font-semibold text-slate"
                : "border-line-strong bg-surface text-ink hover:bg-slate-tint",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

export function SubmissionFiltersBar({ filters }: { filters: SubmissionFilters }) {
  return (
    <nav aria-label="Filter submissions" className="grid gap-3">
      <FilterGroup
        label="Show"
        options={SUBMISSION_TYPE_FILTERS}
        current={filters.type}
        hrefFor={(type) => submissionsHref({ ...filters, type })}
      />
      <FilterGroup
        label="Status"
        options={SUBMISSION_STATUS_FILTERS}
        current={filters.status}
        hrefFor={(status) => submissionsHref({ ...filters, status })}
      />
    </nav>
  );
}
