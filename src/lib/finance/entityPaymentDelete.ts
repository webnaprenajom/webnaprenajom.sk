/**
 * Payment delete guard — block when audited commission payouts exist on the same entity deal.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  resolveCommissionPayoutInfo,
  type PayoutRecordLike,
} from "@/lib/finance/commissionPayoutStatus";
import type { EntityPaymentSourceTable } from "@/lib/finance/entityPaymentMutations";
import type { CommissionSourceType } from "@/lib/commissionSource";

const SOURCE_TABLE_TO_COMMISSION_TYPE: Record<EntityPaymentSourceTable, CommissionSourceType> = {
  project_notes: "project",
  hosting_records: "hosting",
  marketing_records: "marketing",
};

export type EntityPaymentDeleteEvaluation = {
  canDelete: boolean;
  blockReason: string | null;
};

export function evaluateEntityPaymentDeleteFromData(
  sourceTable: EntityPaymentSourceTable,
  sourceId: string,
  commissions: Array<{ id: string }>,
  payoutRecords: PayoutRecordLike[],
): EntityPaymentDeleteEvaluation {
  for (const c of commissions) {
    const info = resolveCommissionPayoutInfo({ id: c.id, payment_status: null }, payoutRecords);
    if (info.recordCount > 0) {
      return {
        canDelete: false,
        blockReason:
          "Platbu nemožno zmazať — na tomto deale už existuje auditovaná výplata provízie (payout_records). Najprv upravte výplatu vo Financiách → Diagnostika.",
      };
    }
  }
  return { canDelete: true, blockReason: null };
}

export async function evaluateEntityPaymentDelete(
  sourceTable: EntityPaymentSourceTable,
  sourceId: string,
): Promise<EntityPaymentDeleteEvaluation> {
  const sourceType = SOURCE_TABLE_TO_COMMISSION_TYPE[sourceTable];
  const [commRes, payoutRes] = await Promise.all([
    supabase
      .from("commissions")
      .select("id")
      .eq("source_type", sourceType)
      .eq("source_id", sourceId),
    supabase
      .from("payout_records")
      .select("source_table,source_id,amount,paid_at,truth_level")
      .eq("source_table", "commissions"),
  ]);

  const commissions = (commRes.data || []) as Array<{ id: string }>;
  const payoutRecords = (payoutRes.data || []) as PayoutRecordLike[];
  const commissionIds = new Set(commissions.map((c) => c.id));
  const linkedPayouts = payoutRecords.filter(
    (p) => p.source_id && commissionIds.has(p.source_id),
  );

  return evaluateEntityPaymentDeleteFromData(sourceTable, sourceId, commissions, linkedPayouts);
}
