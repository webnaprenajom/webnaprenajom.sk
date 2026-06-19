/** rental_websites.implementers JSON — shared normalize/serialize (no DB migration). */

import type { PaymentFormValue } from "@/lib/paymentForm";

export type RentalImplementerPaymentStatus = "paid" | "unpaid";

export type RentalImplementer = {
  name: string;
  percentage: number;
  payment_status: RentalImplementerPaymentStatus;
  payment_form?: PaymentFormValue | "";
  note?: string;
};

const PAYMENT_FORMS = new Set(["cash", "iban", "crypto", "faktura", "ine"]);

export function normalizeRentalImplementerPaymentStatus(raw: unknown): RentalImplementerPaymentStatus {
  return raw === "paid" ? "paid" : "unpaid";
}

export function normalizeRentalImplementers(raw: unknown): RentalImplementer[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r: unknown): RentalImplementer => {
      const row = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
      const paymentForm = PAYMENT_FORMS.has(String(row.payment_form))
        ? (row.payment_form as PaymentFormValue)
        : "";
      return {
        name: String(row.name ?? "").trim(),
        percentage: Number(row.percentage) || 0,
        payment_status: normalizeRentalImplementerPaymentStatus(row.payment_status),
        payment_form: paymentForm,
        note: String(row.note ?? "").trim(),
      };
    })
    .filter((r) => r.name);
}

/** Persist shape for rental_websites.implementers JSONB. */
export function serializeRentalImplementerForSave(imp: RentalImplementer): Record<string, unknown> {
  const row: Record<string, unknown> = {
    name: imp.name.trim(),
    percentage: Number(imp.percentage) || 0,
    payment_status: imp.payment_status === "paid" ? "paid" : "unpaid",
  };
  if (imp.payment_form) row.payment_form = imp.payment_form;
  if (imp.note?.trim()) row.note = imp.note.trim();
  return row;
}
