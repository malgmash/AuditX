import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// DESIGN.md status mapping. 12px semibold, 22px tall, 6px radius. Every badge carries text.
const badgeVariants = cva(
  "inline-flex h-[22px] w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-control border px-2 text-xs font-semibold [&>svg]:size-3",
  {
    variants: {
      variant: {
        /** Cleared, approved, released, reimbursed */
        cleared: "border-transparent bg-sage-tint text-sage-text",
        /** Held, pending review, case open */
        held: "border-transparent bg-copper-tint text-copper-text",
        /** Severity IMMEDIATE_HOLD */
        hold: "border-transparent bg-copper text-bone",
        /** Severity CASE */
        case: "border-copper bg-copper-tint text-copper-text",
        /** Severity NOTE, and "Reviewed, no action taken" */
        note: "border-line bg-transparent text-ink-muted",
        /** Selected, informational */
        info: "border-transparent bg-slate-tint text-slate",
      },
    },
    defaultVariants: { variant: "note" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
