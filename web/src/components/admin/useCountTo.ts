"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A number counting from its old value to its new one. The single expressive animation in the
 * design: 600ms, and an instant change when the viewer asks for reduced motion.
 */
export function useCountTo(target: number | null, from: number | null) {
  const [value, setValue] = useState(from);
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (target === null || from === null) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setValue(target);
      return;
    }

    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 600);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round((from + (target - from) * eased) * 10) / 10);
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);

    return () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    };
  }, [target, from]);

  return value;
}
