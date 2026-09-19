"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

// Light theme only. Use a toast only to confirm an action with no other visible result.
const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="light"
    style={
      {
        "--normal-bg": "var(--color-surface)",
        "--normal-text": "var(--color-ink)",
        "--normal-border": "var(--color-line-strong)",
        "--border-radius": "8px",
      } as React.CSSProperties
    }
    {...props}
  />
);

export { Toaster };
