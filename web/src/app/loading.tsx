import { Logo } from "@/components/brand/Logo";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading AuditX">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between px-6">
          <Logo href="/" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-[1200px] items-center gap-12 px-6 py-16 lg:grid-cols-2">
        <div>
          <Skeleton className="h-12 w-full max-w-md" />
          <Skeleton className="mt-3 h-12 w-3/4 max-w-sm" />
          <Skeleton className="mt-6 h-5 w-full max-w-xl" />
          <Skeleton className="mt-2 h-5 w-4/5 max-w-lg" />
          <div className="mt-8 flex gap-3">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-36" />
          </div>
        </div>
        <Skeleton className="aspect-[4/5] w-full max-w-md justify-self-end" />
      </main>
      <p className="sr-only">Loading the public landing page</p>
    </div>
  );
}
