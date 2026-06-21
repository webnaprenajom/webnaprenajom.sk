/**
 * Live vs historical commission entitlement — rental JSON + entity deal parents.
 * Materialized commissions.source_type=rental are live only while implementer remains in JSON.
 * Project/hosting/marketing commissions require a live parent row in Finance UX.
 */
import type { CommissionRow } from "@/lib/commissionSource";
import { normalizeRentalImplementers } from "@/lib/rentalImplementers";
import type { PayoutRecordLike } from "@/lib/finance/commissionPayoutStatus";

export type RentalWebsiteEntitlementInput = {
  id: string;
  implementers?: unknown;
};

export type CommissionParentContext = {
  projectIds: ReadonlySet<string>;
  hostingIds: ReadonlySet<string>;
  marketingIds: ReadonlySet<string>;
  rentalWebsiteIds: ReadonlySet<string>;
};

export function buildCommissionParentContext(input: {
  projects?: ReadonlyArray<{ id: string }>;
  hosting?: ReadonlyArray<{ id: string }>;
  marketing?: ReadonlyArray<{ id: string }>;
  websites?: ReadonlyArray<{ id: string }>;
}): CommissionParentContext {
  return {
    projectIds: new Set((input.projects ?? []).map((r) => r.id)),
    hostingIds: new Set((input.hosting ?? []).map((r) => r.id)),
    marketingIds: new Set((input.marketing ?? []).map((r) => r.id)),
    rentalWebsiteIds: new Set((input.websites ?? []).map((r) => r.id)),
  };
}

function entityParentExists(
  sourceType: string | null | undefined,
  sourceId: string | null | undefined,
  parents: CommissionParentContext,
): boolean | null {
  const id = sourceId?.trim();
  if (!id) return null;
  switch (sourceType) {
    case "project":
      return parents.projectIds.has(id);
    case "hosting":
      return parents.hostingIds.has(id);
    case "marketing":
      return parents.marketingIds.has(id);
    default:
      return null;
  }
}

/** Entity-linked payment_records count only when parent deal still exists. */
export function paymentRecordHasLiveDealParent(
  row: {
    source_table?: string | null;
    source_id?: string | null;
    rental_website_id?: string | null;
  },
  parents: CommissionParentContext,
): boolean {
  const table = row.source_table?.trim();
  const id = row.source_id?.trim();
  if (table === "project_notes" && id) return parents.projectIds.has(id);
  if (table === "hosting_records" && id) return parents.hostingIds.has(id);
  if (table === "marketing_records" && id) return parents.marketingIds.has(id);
  const rentalId = row.rental_website_id?.trim();
  if (rentalId) return parents.rentalWebsiteIds.has(rentalId);
  return true;
}

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
  parents?: CommissionParentContext,
): boolean {
  if (payout.source_table !== "commissions") return true;
  const commissionId = payout.source_id?.trim();
  if (!commissionId) return false;
  const commission = commissionsById.get(commissionId);
  if (!commission) return false;
  return rentalCommissionSurfacesInProductUx(
    classifyRentalCommissionLiveState(commission, websites, payoutRecords, parents),
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
  parents?: CommissionParentContext,
): RentalCommissionLiveState {
  if (parents) {
    const parentPresent = entityParentExists(
      commission.source_type,
      commission.source_id,
      parents,
    );
    if (parentPresent === false) {
      if (auditedPayoutTotalForCommission(commission.id, payoutRecords) > 0) {
        return "historical_paid";
      }
      return "stale_orphan";
    }
  }

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
  parents?: CommissionParentContext,
): boolean {
  return (
    classifyRentalCommissionLiveState(commission, websites, payoutRecords, parents) ===
    "stale_orphan"
  );
}
