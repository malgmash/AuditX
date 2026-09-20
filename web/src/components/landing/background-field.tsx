"use client";

import { useEffect, useRef } from "react";

/**
 * The landing page's decorative layer, permitted by the Marketing surface section of DESIGN.md:
 * flat Ink dots under 8% opacity drifting slowly behind the hero and the closing block, over two
 * oversized Copper and Sage shapes. Pointer events off, hidden from assistive technology, and under
 * prefers-reduced-motion it draws one static frame and starts no loop.
 */

const DOT_COUNT = 90;
const DOT_OPACITY = 0.06;
/** Pixels per second. Slow enough that the field reads as paper depth, not animation. */
const MIN_SPEED = 2;
const MAX_SPEED = 4;

type Dot = { x: number; y: number; dx: number; dy: number };

function createDots(): Dot[] {
  return Array.from({ length: DOT_COUNT }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
    return {
      x: Math.random(),
      y: Math.random(),
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed,
    };
  });
}

export function BackgroundField({
  className = "",
  shape = "large",
}: {
  className?: string;
  /** Sized to the section, so the shapes are only ever cut by the viewport edge, never by the
      section's own top or bottom, which would leave a visible straight edge. */
  shape?: "large" | "small";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const dots = createDots();
    const ink = getComputedStyle(document.documentElement).getPropertyValue("--color-ink").trim();
    let width = 0;
    let height = 0;
    let frame = 0;
    let last = 0;

    const measure = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const paint = () => {
      context.clearRect(0, 0, width, height);
      context.globalAlpha = DOT_OPACITY;
      context.fillStyle = ink || "currentColor";
      for (const dot of dots) {
        context.fillRect(Math.round(dot.x * width), Math.round(dot.y * height), 1, 1);
      }
    };

    const step = (time: number) => {
      const elapsed = last ? Math.min(time - last, 100) : 0;
      last = time;
      if (width > 0 && height > 0) {
        for (const dot of dots) {
          dot.x = (dot.x + (dot.dx * elapsed) / 1000 / width + 1) % 1;
          dot.y = (dot.y + (dot.dy * elapsed) / 1000 / height + 1) % 1;
        }
      }
      paint();
      frame = window.requestAnimationFrame(step);
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const start = () => {
      window.cancelAnimationFrame(frame);
      last = 0;
      if (reduced.matches) {
        paint();
        return;
      }
      frame = window.requestAnimationFrame(step);
    };

    const observer = new ResizeObserver(() => {
      measure();
      if (reduced.matches) paint();
    });

    measure();
    observer.observe(canvas);
    start();
    reduced.addEventListener("change", start);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      reduced.removeEventListener("change", start);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className}`}
    >
      <div className="absolute top-[4%] -right-24 size-96 rounded-full bg-copper/[0.08]" />
      <div className="absolute top-[22%] -left-28 size-80 rounded-full bg-sage/[0.08]" />
      <div className="absolute top-[48%] right-[-12%] size-96 rounded-full bg-ink/[0.05]" />
      <div className="absolute top-[70%] -left-20 size-96 rounded-full bg-copper/[0.08]" />
      <div className="absolute top-[88%] right-0 size-72 rounded-full bg-sage/[0.08]" />
      <canvas ref={canvasRef} className="size-full" />
    </div>
  );
}
