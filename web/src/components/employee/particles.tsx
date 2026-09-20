"use client";

import type { CSSProperties } from "react";
import styles from "./particles.module.css";

/**
 * Soft brand-tint dots behind the employee shell. Decorative only; hidden when
 * the user prefers reduced motion. No glow, no gradient fills.
 */
export function EmployeeParticles() {
  return (
    <div className={styles.field} aria-hidden="true">
      {Array.from({ length: 18 }, (_, index) => (
        <span
          key={index}
          className={styles.dot}
          style={{ "--i": index } as CSSProperties}
        />
      ))}
    </div>
  );
}
