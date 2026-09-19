import { cn } from "@/lib/utils";

// Loading placeholder in line and Surface tones. No pulsing.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="skeleton" className={cn("rounded-control bg-line", className)} {...props} />
  );
}

export { Skeleton };
