/**
 * The page's one recurring motif: two records set on a shared baseline, joined by a copper hairline.
 * It is drawn, never decorated. No fills, no glow. Colours come from the CSS tokens so the palette
 * stays in globals.css.
 */

/** Half a bracket, used in the gutter of the flagged records table to join two matched rows. */
export function PairMark({ position }: { position: "top" | "bottom" }) {
  return (
    <span aria-hidden="true" className="relative block w-2 self-stretch">
      <span
        className={`absolute left-1 w-px bg-copper ${position === "top" ? "top-1/2 bottom-0" : "top-0 bottom-1/2"}`}
      />
      <span className="absolute top-1/2 left-0 size-2 -translate-y-1/2 rounded-full border border-copper bg-surface" />
    </span>
  );
}

const TICK_COUNT = 22;
const TICK_GAP = 8;
/** The one claim in each month that matches the other. */
const MATCHED = { first: 4, second: 15 };

const WIDTH = TICK_COUNT * TICK_GAP + TICK_GAP;
const TOP = { start: 8, end: 24 };
const BOTTOM = { start: 72, end: 88 };

function x(index: number) {
  return index * TICK_GAP + TICK_GAP;
}

/**
 * Two months of claims as evenly spaced hairlines, one row each, with the single claim in each month
 * that matches the other drawn in copper and joined through the middle. The visual form of "one
 * transaction may look harmless, a pattern tells a different story".
 */
export function TickField({ className = "" }: { className?: string }) {
  const rows = [
    { band: TOP, matched: MATCHED.first },
    { band: BOTTOM, matched: MATCHED.second },
  ];

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${WIDTH} 96`}
      preserveAspectRatio="none"
      className={`h-24 w-full ${className}`}
    >
      {rows.map((row) =>
        Array.from({ length: TICK_COUNT }, (_, index) => {
          const matched = index === row.matched;
          return (
            <line
              key={`${row.band.start}-${index}`}
              x1={x(index)}
              x2={x(index)}
              y1={matched ? row.band.start : row.band.start + 4}
              y2={matched ? row.band.end : row.band.end - 4}
              stroke={matched ? "var(--color-copper)" : "var(--color-line-strong)"}
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          );
        }),
      )}
      <path
        d={`M ${x(MATCHED.first)} ${TOP.end} V 48 H ${x(MATCHED.second)} V ${BOTTOM.start}`}
        fill="none"
        stroke="var(--color-copper)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
