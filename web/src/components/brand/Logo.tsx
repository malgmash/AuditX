import Link from "next/link";

/**
 * The AuditX wordmark: "audit" in Ink, a Copper dot, "x" in Slate.
 * Rendered as text in Newsreader at 24px so it stays sharp. See DESIGN.md, Logo.
 * Do not recolour, stretch or add effects.
 */
export function Logo({ href, className = "" }: { href?: string; className?: string }) {
  const mark = (
    <span
      className={`inline-flex items-baseline font-serif text-2xl font-medium leading-none tracking-tight ${className}`}
      aria-label="AuditX"
    >
      <span className="text-ink" aria-hidden="true">
        audit
      </span>
      <span className="text-copper" aria-hidden="true">
        .
      </span>
      <span className="text-slate" aria-hidden="true">
        x
      </span>
    </span>
  );
  return href ? (
    <Link href={href} className="rounded-control">
      {mark}
    </Link>
  ) : (
    mark
  );
}
