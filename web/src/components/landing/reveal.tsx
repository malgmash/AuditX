"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import styles from "./landing.module.css";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delayMs?: number;
  as?: ElementType;
} & Omit<HTMLAttributes<HTMLElement>, "className" | "children" | "style">;

type RevealState = "pending" | "hidden" | "visible";

export function Reveal({
  children,
  className = "",
  delayMs = 0,
  as: Tag = "div",
  ...rest
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<RevealState>("pending");

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setState("visible");
      return;
    }

    const show = () => setState("visible");

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          show();
          observer.disconnect();
        } else {
          setState("hidden");
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const motionClass =
    state === "hidden"
      ? styles.reveal
      : state === "visible"
        ? `${styles.reveal} ${styles.revealVisible}`
        : "";

  return (
    <Tag
      ref={ref}
      className={`${motionClass} ${className}`.trim()}
      style={
        delayMs
          ? ({ "--reveal-delay": `${delayMs}ms` } as CSSProperties)
          : undefined
      }
      {...rest}
    >
      {children}
    </Tag>
  );
}
