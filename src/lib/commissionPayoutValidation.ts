import type { CommissionSourceType } from "@/lib/commissionSource";

/** Source types where paid workflow requires payout audit fields. */
export const COMMISSION_PAID_PAYOUT_SOURCE_TYPES: CommissionSourceType[] = [
  "project",
  "hosting",
  "marketing",
];

export type CommissionPaidPayoutField = "payment_form" | "note";

export function requiresCommissionPaidPayoutDetails(
  sourceType: string | null | undefined,
): boolean {
  return COMMISSION_PAID_PAYOUT_SOURCE_TYPES.includes(sourceType as CommissionSourceType);
}

export function missingCommissionPaidPayoutFields(row: {
  payment_status: string;
  payment_form?: string | null;
  note?: string | null;
  source_type?: string | null;
}): CommissionPaidPayoutField[] {
  if (row.payment_status !== "paid") return [];
  if (!requiresCommissionPaidPayoutDetails(row.source_type)) return [];

  const missing: CommissionPaidPayoutField[] = [];
  if (!row.payment_form?.trim()) missing.push("payment_form");
  if (!row.note?.trim()) missing.push("note");
  return missing;
}

export function validateCommissionPaidPayoutDetails(row: {
  payment_status: string;
  payment_form?: string | null;
  note?: string | null;
  source_type?: string | null;
}): { valid: true } | { valid: false; missing: CommissionPaidPayoutField[]; message: string } {
  const missing = missingCommissionPaidPayoutFields(row);
  if (missing.length === 0) return { valid: true };

  const labels: Record<CommissionPaidPayoutField, string> = {
    payment_form: "forma úhrady",
    note: "poznámka",
  };
  const parts = missing.map((f) => labels[f]);
  const message =
    parts.length === 2
      ? "Pred uložením stavu „vyplatené“ vyplňte formu úhrady a poznámku."
      : `Pred uložením stavu „vyplatené“ vyplňte ${parts[0]}.`;

  return { valid: false, missing, message };
}

/** Map Postgres trigger errors to user-facing Slovak copy. */
export function commissionPaidPayoutDbErrorMessage(errorMessage: string): string | null {
  if (errorMessage.includes("paid_commission_requires_payment_form")) {
    return "Pred uložením stavu „vyplatené“ vyplňte formu úhrady.";
  }
  if (errorMessage.includes("paid_commission_requires_note")) {
    return "Pred uložením stavu „vyplatené“ vyplňte poznámku k výplate.";
  }
  if (
    errorMessage.toLowerCase().includes("amount_mode") &&
    errorMessage.toLowerCase().includes("schema cache")
  ) {
    return "Databáza nemá stĺpce amount_mode/rate_percent. Spustite migráciu 20260621130000 (supabase db push) alebo uložte bez percentuálneho režimu.";
  }
  return null;
}
