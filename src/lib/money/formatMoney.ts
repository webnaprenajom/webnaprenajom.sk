/** Shared CRM money rounding — 1 decimal place, standard half-up. */

export function roundTo1Decimal(value: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

/** Numeric string with exactly one fraction digit (e.g. 41.7). */
export function formatAmount1Decimal(value: number | null | undefined): string {
  return roundTo1Decimal(Number(value ?? 0)).toFixed(1);
}

/** Display currency with 1 decimal and optional suffix (default €). */
export function formatCurrency1Decimal(
  value: number | null | undefined,
  options?: { suffix?: string; empty?: string },
): string {
  const n = Number(value ?? 0);
  const empty = options?.empty ?? "—";
  if (!Number.isFinite(n) || n <= 0) return empty;
  const suffix = options?.suffix ?? " €";
  return `${formatAmount1Decimal(n)}${suffix}`;
}

/** Shorthand for inline JSX — positive amounts only, dash for zero/empty. */
export function fmtEur(value: number | null | undefined): string {
  return formatCurrency1Decimal(value);
}

/** Parse user money input and round for persistence / calculations. */
export function parseMoneyInput(raw: string): number {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) return 0;
  return roundTo1Decimal(Math.max(0, parseFloat(normalized) || 0));
}
