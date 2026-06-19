import { COMMISSION_STATUS_LABELS } from "@/lib/finance/labels";
import type { PayoutRecord } from "./types";

/** Commission IDs with at least one payout_record (any truth level RLS returned). */
export function payoutRecordByCommissionId(
  payouts: PayoutRecord[],
): Map<string, PayoutRecord> {
  const map = new Map<string, PayoutRecord>();
  payouts.forEach((p) => {
    if (p.source_table === "commissions" && p.source_id) {
      map.set(p.source_id, p);
    }
  });
  return map;
}

export function hasConfirmedPayout(
  commissionId: string,
  payouts: PayoutRecord[],
): boolean {
  return payouts.some(
    (p) =>
      p.source_table === "commissions" &&
      p.source_id === commissionId &&
      (p.truth_level === "payout_fact" || p.truth_level === "legacy_import"),
  );
}

/** Single source of truth for commission status copy in Customer Hub. */
export function commissionHubStatusLabel(
  paymentStatus: string,
  hasPayoutFact: boolean,
): string {
  if (hasPayoutFact) {
    return paymentStatus === "paid"
      ? `${COMMISSION_STATUS_LABELS.paid} · potvrdené v payout_records`
      : "Potvrdená výplata (payout_records)";
  }
  return paymentStatus === "paid"
    ? COMMISSION_STATUS_LABELS.paid
    : COMMISSION_STATUS_LABELS.unpaid;
}

export function commissionHubStatusTone(
  paymentStatus: string,
  hasPayoutFact: boolean,
): "warning" | "success" | "muted" {
  if (hasPayoutFact) return "success";
  if (paymentStatus === "paid") return "warning";
  return "muted";
}
