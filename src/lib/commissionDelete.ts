/**
 * Owner commission delete — block when audited payout_records exist (audit trail).
 */
import {
  resolveCommissionPayoutInfo,
  type PayoutRecordLike,
} from "@/lib/finance/commissionPayoutStatus";

export type CommissionDeleteEvaluation = {
  canDelete: boolean;
  blockReason: string | null;
};

export function evaluateCommissionDelete(
  commissionId: string,
  payoutRecords: PayoutRecordLike[],
): CommissionDeleteEvaluation {
  const info = resolveCommissionPayoutInfo({ id: commissionId, payment_status: null }, payoutRecords);
  if (info.recordCount > 0) {
    return {
      canDelete: false,
      blockReason:
        "Provízia má auditovanú výplatu v payout_records. Najprv upravte alebo odstráňte výplatu vo Financiách → Diagnostika → Záznamy (payout_records).",
    };
  }
  return { canDelete: true, blockReason: null };
}
