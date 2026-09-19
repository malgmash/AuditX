// Money is integer cents everywhere. Convert only at the edge: when a person types an amount,
// and when one is shown. No floating point arithmetic touches a money value.

/**
 * Parse a dollar amount typed by a person into integer cents, without floats.
 * Accepts "12.34", "$1,000.00", "0.1", "5". Returns null when the text is not a valid amount
 * or has more than two decimal places.
 */
export function dollarsToCents(input: string): number | null {
  const cleaned = input.trim().replace(/^\$/, "").replace(/,/g, "");
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!m) return null;
  const whole = Number(m[1]);
  const frac = Number((m[2] ?? "").padEnd(2, "0"));
  const cents = whole * 100 + frac;
  return Number.isSafeInteger(cents) ? cents : null;
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Format integer cents for display, for example 320000 becomes "$3,200.00". */
export function formatCents(cents: number): string {
  if (!Number.isInteger(cents)) throw new Error("formatCents expects integer cents");
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return sign + usd.format(Math.trunc(abs / 100) + (abs % 100) / 100);
}
