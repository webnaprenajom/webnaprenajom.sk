/** Finance diagnostika — URL helpers (presentation only, no truth-model changes). */

export const FINANCE_DIAGNOSTIKA_TABS = ["reconciliation", "records", "settlement"] as const;
export type FinanceDiagnostikaTab = (typeof FINANCE_DIAGNOSTIKA_TABS)[number];

export const FINANCE_RECORD_KINDS = ["payment", "payout", "cost"] as const;
export type FinanceRecordKind = (typeof FINANCE_RECORD_KINDS)[number];

export function resolveFinanceDiagnostikaTab(tab: string | null | undefined): FinanceDiagnostikaTab {
  if (tab === "records" || tab === "settlement") return tab;
  return "reconciliation";
}

export function legacyParamToRecordKind(legacy: string): FinanceRecordKind | null {
  if (legacy === "payments") return "payment";
  if (legacy === "payouts") return "payout";
  if (legacy === "costs") return "cost";
  return null;
}

/** Normalize ?legacy= deep links into diagnostika tab + recordsKind. */
export function normalizeFinanceLegacyDeepLink(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  const legacy = next.get("legacy");
  if (!legacy) return next;

  if (legacy === "commissions") {
    next.delete("legacy");
    next.delete("advanced");
    next.delete("tab");
    next.delete("recordsKind");
    return next;
  }

  const recordKind = legacyParamToRecordKind(legacy);
  if (recordKind) {
    next.set("advanced", "1");
    next.set("tab", "records");
    next.set("recordsKind", recordKind);
    next.delete("legacy");
  }

  return next;
}

export function financeReconciliationHref(): string {
  return "/admin/finance?advanced=1&tab=reconciliation";
}

export function financeRecordsHref(kind?: FinanceRecordKind): string {
  const params = new URLSearchParams({ advanced: "1", tab: "records" });
  if (kind) params.set("recordsKind", kind);
  return `/admin/finance?${params.toString()}`;
}
