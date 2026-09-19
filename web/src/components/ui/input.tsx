import * as React from "react";
import { cn } from "@/lib/utils";

// DESIGN.md: 36px, Surface fill, 1px line-strong border, 6px radius, 14px text.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-control border border-line-strong bg-surface px-3 text-sm text-ink transition-colors duration-150 placeholder:text-ink-muted disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-error",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
