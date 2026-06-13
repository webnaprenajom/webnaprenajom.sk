/**
 * Lightweight commission source consistency helpers (Batch RC6.5).
 */

export type CommissionLike = {
  id?: string;
  implementer?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  payment_status?: string | null;
  amount?: number | null;
};

export type RentalImplementerShare = {
  name: string;
  percentage: number;
};

export type CommissionSourceKind = "normalized" | "legacy" | "rental_json";

export function classifyCommissionSource(row: CommissionLike): CommissionSourceKind {
  if (row.source_type === "rental" && row.source_id) return "normalized";
  if (row.source_type && row.source_type !== "other") return "normalized";
  if (!row.source_type && !row.source_id) return "legacy";
  return "legacy";
}

export function commissionSourceLabel(kind: CommissionSourceKind): string {
  switch (kind) {
    case "normalized":
      return "Provízia (prepojená)";
    case "legacy":
      return "Legacy / bez zdroja";
    case "rental_json":
      return "Prenájom (% podiel)";
  }
}

/** Warn when same implementer has both rental JSON shares and normalized rental commissions. */
export function detectRentalDualModelWarning(
  implementerName: string,
  normalizedRentalCount: number,
  jsonShareCount: number,
): string | null {
  if (normalizedRentalCount <= 0 || jsonShareCount <= 0) return null;
  return (
    `${implementerName}: súčasne ${jsonShareCount} prenájmových podielov (JSON) ` +
    `a ${normalizedRentalCount} normalizovaných provízií — skontrolujte, či sa nepočítajú dvakrát.`
  );
}

export function countBySourceKind(rows: CommissionLike[]): Record<CommissionSourceKind, number> {
  const counts: Record<CommissionSourceKind, number> = {
    normalized: 0,
    legacy: 0,
    rental_json: 0,
  };
  for (const r of rows) {
    counts[classifyCommissionSource(r)] += 1;
  }
  return counts;
}

export function unpaidTotal(rows: CommissionLike[]): number {
  return rows
    .filter((r) => r.payment_status !== "paid")
    .reduce((s, r) => s + Number(r.amount || 0), 0);
}

export function paidTotal(rows: CommissionLike[]): number {
  return rows
    .filter((r) => r.payment_status === "paid")
    .reduce((s, r) => s + Number(r.amount || 0), 0);
}
