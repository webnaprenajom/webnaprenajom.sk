import { supabase } from "@/integrations/supabase/client";
import type { CommissionRow } from "@/lib/commissionSource";
import { prefillFromCommission, type FactDraft } from "@/lib/finance/factDrafts";

const EMPTY_FINANCE_CTX = {
  commissions: [],
  expenses: [],
  websites: [],
  payments: [],
  paymentRecords: [],
  payoutRecords: [],
  costRecords: [],
};

export type CommissionPayoutBridgeResult =
  | { action: "linked_exists" }
  | { action: "open_dialog"; draft: FactDraft }
  | { action: "no_draft" };

export type CommissionForPayoutBridge = Pick<
  CommissionRow,
  "id" | "amount" | "date" | "implementer" | "note" | "title"
>;

/** Pure: offer payout fact dialog only when transitioning to paid without a linked payout. */
export function shouldOfferCommissionPayoutFact(
  previousStatus: string,
  nextStatus: string,
  hasLinkedPayout: boolean,
): boolean {
  return previousStatus !== "paid" && nextStatus === "paid" && !hasLinkedPayout;
}

export function commissionHasLinkedPayoutInRows(
  commissionId: string,
  payoutRows: Array<{ source_table?: string | null; source_id?: string | null }>,
): boolean {
  return payoutRows.some((r) => r.source_table === "commissions" && r.source_id === commissionId);
}

export async function commissionHasLinkedPayout(commissionId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("payout_records")
    .select("id")
    .eq("source_table", "commissions")
    .eq("source_id", commissionId)
    .maybeSingle();
  if (error) return false;
  return !!data?.id;
}

export function buildCommissionPayoutFactDraft(
  commission: CommissionForPayoutBridge,
): FactDraft | null {
  return prefillFromCommission(commission, EMPTY_FINANCE_CTX);
}

export async function resolveCommissionPayoutBridgeAfterMarkPaid(
  commission: CommissionForPayoutBridge,
): Promise<CommissionPayoutBridgeResult> {
  if (await commissionHasLinkedPayout(commission.id)) {
    return { action: "linked_exists" };
  }
  const draft = buildCommissionPayoutFactDraft(commission);
  if (!draft) return { action: "no_draft" };
  return { action: "open_dialog", draft };
}
