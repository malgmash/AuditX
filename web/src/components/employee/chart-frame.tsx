"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export const CHART_TOOLTIP_STYLE = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-line)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--color-ink)",
  boxShadow: "none",
} as const;

export function ChartFrame({
  heightClassName = "h-48",
  children,
}: {
  heightClassName?: string;
  children: (size: { width: number; height: number }) => ReactNode;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const sync = () => setSize({ width: node.clientWidth, height: node.clientHeight });
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frame} className={`w-full ${heightClassName}`}>
      {size.width > 0 && size.height > 0 ? children(size) : null}
    </div>
  );
}
