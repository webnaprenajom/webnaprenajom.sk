/**
 * Live vs historical rental commission entitlement — JSON on rental_websites is workflow truth.
 * Materialized commissions.source_type=rental are live only while implementer remains in JSON.
 */
import type { CommissionRow } from "@/lib/commissionSource";
import { normalizeRentalImplementers } from "@/lib/rentalImplementers";
import type { PayoutRecordLike } from "@/lib/finance/commissionPayoutStatus";

export type RentalWebsiteEntitlementInput = {
  id: string;
  implementers?: unknown;
};

export type RentalCommissionLiveState = "live" | "historical_paid" | "stale_orphan" | "not_rental";

/** Main Finance UX — live entitlement or non-rental commissions only; payout-only revoked rental stays in audit tables. */
export function rentalCommissionSurfacesInProductUx(
  liveState: RentalCommissionLiveState,
): boolean {
  return liveState === "live" || liveState === "not_rental";
}

type CommissionEntitlementInput = Pick<
  CommissionRow,
  "id" | "source_type" | "source_id" | "implementer" | "payment_status"
>;

/** Whether a commission-linked payout belongs in implementer leaderboard / deal views (not raw payout_records audit). */
export function commissionLinkedPayoutSurfacesInProductUx(
  payout: Pick<PayoutRecordLike, "source_table" | "source_id">,
  commissionsById: ReadonlyMap<string, CommissionEntitlementInput>,
  websites: readonly RentalWebsiteEntitlementInput[],
  payoutRecords: readonly PayoutRecordLike[],
): boolean {
  if (payout.source_table !== "commissions") return true;
  const commissionId = payout.source_id?.trim();
  if (!commissionId) return false;
  const commission = commissionsById.get(commissionId);
  if (!commission) return false;
  return rentalCommissionSurfacesInProductUx(
    classifyRentalCommissionLiveState(commission, websites, payoutRecords),
  );
}

export function rentalImplementerHasLiveEntitlement(
  websiteId: string | null | undefined,
  implementerName: string | null | undefined,
  websites: readonly RentalWebsiteEntitlementInput[],
): boolean {
  const siteId = websiteId?.trim();
  const name = implementerName?.trim().toLowerCase();
  if (!siteId || !name) return false;
  const website = websites.find((w) => w.id === siteId);
  if (!website) return false;
  return normalizeRentalImplementers(website.implementers).some(
    (imp) =>
      imp.name.trim().toLowerCase() === name && (Number(imp.percentage) || 0) > 0,
  );
}

function auditedPayoutTotalForCommission(
  commissionId: string,
  payoutRecords: readonly PayoutRecordLike[],
): number {
  return payoutRecords
    .filter((r) => r.source_table === "commissions" && r.source_id === commissionId)
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);
}

export function classifyRentalCommissionLiveState(
  commission: Pick<
    CommissionRow,
    "id" | "source_type" | "source_id" | "implementer" | "payment_status"
  >,
  websites: readonly RentalWebsiteEntitlementInput[],
  payoutRecords: readonly PayoutRecordLike[],
): RentalCommissionLiveState {
  if (commission.source_type !== "rental" || !commission.source_id?.trim()) {
    return "not_rental";
  }
  if (rentalImplementerHasLiveEntitlement(commission.source_id, commission.implementer, websites)) {
    return "live";
  }
  if (auditedPayoutTotalForCommission(commission.id, payoutRecords) > 0) {
    return "historical_paid";
  }
  return "stale_orphan";
}

export function isStaleOrphanRentalCommission(
  commission: Pick<
    CommissionRow,
    "id" | "source_type" | "source_id" | "implementer" | "payment_status"
  >,
  websites: readonly RentalWebsiteEntitlementInput[],
  payoutRecords: readonly PayoutRecordLike[],
): boolean {
  return (
    classifyRentalCommissionLiveState(commission, websites, payoutRecords) === "stale_orphan"
  );
}
