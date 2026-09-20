import { Skeleton } from "@/components/ui/skeleton";

export function OverviewSkeleton() {
  return (
    <div className="grid gap-8" aria-busy="true" aria-live="polite">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div className="grid gap-2">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <Skeleton className="h-24 w-full rounded-card" />
      <Skeleton className="h-44 w-full rounded-card" />
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line md:grid-cols-4">
        <Skeleton className="h-24 w-full rounded-none" />
        <Skeleton className="h-24 w-full rounded-none" />
        <Skeleton className="h-24 w-full rounded-none" />
        <Skeleton className="h-24 w-full rounded-none" />
      </div>
      <div className="grid gap-8 border-t border-line pt-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(16rem,1fr)]">
        <Skeleton className="h-56 w-full rounded-card" />
        <Skeleton className="h-56 w-full rounded-card" />
      </div>
    </div>
  );
}
