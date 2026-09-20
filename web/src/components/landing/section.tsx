import type { ReactNode } from "react";

/** The single measure every landing section is set to. Keeps the left edge aligned down the page. */
export function Container({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={`mx-auto w-full max-w-[1200px] px-6 ${className}`}>{children}</div>;
}
