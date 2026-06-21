/**
 * Normalized commission insert payload (Batch RC5).
 */

import {
  sanitizeCommissionSourceFields,
  validateCommissionSourceFields,
  type CommissionSourceType,
} from "@/lib/commissionSource";
import type { Database } from "@/integrations/supabase/types";
import type { CommissionAmountMode } from "@/lib/commissionAmount";
import { validateCommissionPaidPayoutDetails } from "@/lib/commissionPayoutValidation";
import type { CommissionSchemaCapabilities } from "@/lib/commissionSchemaCapabilities";

type CommissionInsertPayload = Database["public"]["Tables"]["commissions"]["Insert"];

export type CommissionInsertInput = {
  title: string;
  amount: number;
  amount_mode?: CommissionAmountMode;
  rate_percent?: number | null;
  date: string;
  implementer: string;
  payment_status?: "paid" | "unpaid";
  payment_form?: string | null;
  note?: string | null;
  source_type?: CommissionSourceType | string | null;
  source_id?: string | null;
  customer_id?: string | null;
  customer_email?: string | null;
};

export type CommissionInsertBuildResult =
  | { ok: true; payload: CommissionInsertPayload; warnings: string[]; error?: never }
  | { ok: false; payload?: never; error: string; warnings: string[] };

export function buildCommissionInsertPayload(
  input: CommissionInsertInput,
  schemaCaps?: CommissionSchemaCapabilities,
): CommissionInsertBuildResult {
  const warnings: string[] = [];
  const implementer = input.implementer?.trim() || "";
  if (!input.title?.trim()) {
    return { ok: false, error: "Chýba názov provízie.", warnings };
  }
  if (!implementer) {
    return { ok: false, error: "Vyberte realizátora provízie.", warnings };
  }

  const source = sanitizeCommissionSourceFields(input.source_type, input.source_id);
  const sourceValidation = validateCommissionSourceFields(source.source_type, source.source_id);
  if (!sourceValidation.valid) {
    return { ok: false, error: sourceValidation.error ?? "Neplatný zdroj provízie.", warnings };
  }
  if (sourceValidation.warning) warnings.push(sourceValidation.warning);

  if (!source.source_type && !source.source_id) {
    if (input.customer_id || input.customer_email) {
      warnings.push(
        "Provízia nemá source_type/source_id — zobrazí sa ako legacy vo financiách. Prepojte zdroj v editore provízií.",
      );
    } else {
      warnings.push("Provízia bez zdroja aj bez klienta — vysoké riziko osirelého riadku.");
    }
  }

  if (!input.customer_id && !input.customer_email) {
    warnings.push("Provízia nemá prepojenie na klienta — customer 360 ju neuvidí.");
  }

  const paidValidation = validateCommissionPaidPayoutDetails({
    payment_status: input.payment_status ?? "unpaid",
    payment_form: input.payment_form,
    note: input.note,
    source_type: source.source_type,
  });
  if (!paidValidation.valid) {
    return { ok: false, error: paidValidation.message, warnings };
  }

  const amountMode: CommissionAmountMode =
    schemaCaps?.percentMode === false ? "fixed" : (input.amount_mode ?? "fixed");

  const payload: CommissionInsertPayload = {
    title: input.title.trim(),
    amount: input.amount,
    date: input.date,
    implementer,
    payment_status: input.payment_status ?? "unpaid",
    payment_form: input.payment_form ?? null,
    note: input.note?.trim() || null,
    source_type: source.source_type,
    source_id: source.source_id,
    customer_id: input.customer_id ?? null,
    customer_email: input.customer_email ?? null,
  };

  if (schemaCaps?.percentMode !== false) {
    payload.amount_mode = amountMode;
    payload.rate_percent = amountMode === "percent" ? (input.rate_percent ?? null) : null;
  }

  return {
    ok: true,
    warnings,
    payload,
  };
}

/**
 * Rental commission coexistence strategy (Batch RC5):
 * - Model A: rental_websites.implementers JSON — % splits from monthly payments (primary for rental KPI cards)
 * - Model B: commissions rows with source_type=rental — explicit bonus/one-off amounts
 * Both are intentional; JSON is NOT auto-synced to commissions table.
 */
export const RENTAL_COMMISSION_COEXISTENCE_NOTE =
  "Prenájom používa JSON podiely pre mesačné % a tabuľku commissions pre explicitné provízne riadky. Oba modely sú platné.";

export function rentalHasJsonImplementers(implementers: unknown): boolean {
  return Array.isArray(implementers) && implementers.some((i) => {
    if (!i || typeof i !== "object") return false;
    const row = i as Record<string, unknown>;
    return !!(row.name && Number(row.percentage) > 0);
  });
}
