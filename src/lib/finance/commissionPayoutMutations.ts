/**
 * Owner correction of commission payout_records — edit/delete payout_fact only.
 * ponytail: no schema change; legacy_import stays read-only here (use Finance Záznamy promote path).
 */
import { supabase } from "@/integrations/supabase/client";
import { PAYMENT_FORM_OPTIONS } from "@/lib/paymentForm";
import type { PayoutRecordLike } from "@/lib/finance/commissionPayoutStatus";
import { fromLocalInput, toLocalInput, type FactDraft } from "@/lib/finance/factDrafts";

export type PayoutRecordForEdit = PayoutRecordLike & {
  id: string;
  implementer?: string | null;
  source_table?: string | null;
  source_id?: string | null;
};

export function canMutatePayoutRecord(truthLevel: string | null | undefined): boolean {
  return truthLevel === "payout_fact";
}

/** Reverse saveFactDraft merge: reference field stores "forma · bankRef". */
export function parsePayoutRecordReference(reference: string | null | undefined): {
  paymentForm: string;
  bankRef: string;
} {
  if (!reference?.trim()) return { paymentForm: "", bankRef: "" };
  const parts = reference
    .split(" · ")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return { paymentForm: "", bankRef: "" };
  if (parts.length === 1) {
    const known = PAYMENT_FORM_OPTIONS.some((o) => o.label === parts[0]);
    return known ? { paymentForm: parts[0], bankRef: "" } : { paymentForm: "", bankRef: parts[0] };
  }
  return { paymentForm: parts[0], bankRef: parts.slice(1).join(" · ") };
}

export function buildPayoutEditDraft(row: PayoutRecordForEdit): FactDraft {
  const { paymentForm, bankRef } = parsePayoutRecordReference(row.reference ?? null);
  return {
    kind: "payout",
    amount: String(row.amount ?? ""),
    paid_at: toLocalInput(row.paid_at),
    implementer: row.implementer ?? "",
    reference: paymentForm || undefined,
    method: bankRef || undefined,
    note: row.note ?? "",
    source_table: row.source_table ?? null,
    source_id: row.source_id ?? null,
    recordId: row.id,
  };
}

function payoutPayloadFromDraft(draft: FactDraft): Record<string, unknown> {
  const amount = Number(draft.amount);
  if (!amount || amount <= 0) throw new Error("Neplatná suma");
  if (!draft.paid_at?.trim()) throw new Error("Chýba dátum výplaty");
  return {
    amount,
    paid_at: fromLocalInput(draft.paid_at),
    implementer: draft.implementer || null,
    reference: [draft.reference, draft.method].filter(Boolean).join(" · ") || null,
    note: draft.note || null,
  };
}

export async function updatePayoutRecord(recordId: string, draft: FactDraft): Promise<void> {
  if (draft.kind !== "payout") throw new Error("Neplatný typ záznamu");
  const payload = payoutPayloadFromDraft(draft);
  const { data, error } = await supabase
    .from("payout_records")
    .update(payload)
    .eq("id", recordId)
    .eq("truth_level", "payout_fact")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("Výplatu sa nepodarilo upraviť (nie je payout_fact alebo neexistuje)");
}

export async function deletePayoutRecord(recordId: string): Promise<void> {
  const { data, error } = await supabase
    .from("payout_records")
    .delete()
    .eq("id", recordId)
    .eq("truth_level", "payout_fact")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("Výplatu sa nepodarilo zmazať (nie je payout_fact alebo neexistuje)");
}

/** ponytail: self-check — paid/remaining/status after mutating transaction list */
export function recomputeDealPayoutFromTransactions(
  potential: number,
  transactions: Array<{ amount: number }>,
): { paid: number; remaining: number; status: "unpaid" | "partially_paid" | "paid" | "overpaid" } {
  const paid = transactions.reduce((s, t) => s + Number(t.amount || 0), 0);
  const remaining = Math.max(potential - paid, 0);
  let status: "unpaid" | "partially_paid" | "paid" | "overpaid" = "unpaid";
  if (paid <= 0) status = "unpaid";
  else if (paid > potential) status = "overpaid";
  else if (paid < potential) status = "partially_paid";
  else status = "paid";
  return { paid, remaining, status };
}
