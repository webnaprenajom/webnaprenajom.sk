/**
 * Unified implementer commission rows for Finance detail — one shape for all source tabs.
 */
import type { CommissionRow, CommissionSourceType } from "@/lib/commissionSource";
import { COMMISSION_SOURCE_LABELS } from "@/lib/commissionSource";
import {
  buildRentalCommissionDeals,
  computeDealRemaining,
  deriveDealPayoutStatus,
  type DealPayoutStatus,
  type PayoutTransaction,
  payoutTransactionsForCommission,
  sumPayoutTransactions,
  type RentalCommissionDeal,
} from "@/lib/finance/rentalCommissionDeal";
import { rentalYearStats } from "@/lib/finance/rentalImplementerFinanceTotals";
import { normalizeRentalImplementers } from "@/lib/rentalImplementers";
import type { PayoutRecordLike } from "@/lib/finance/commissionPayoutStatus";
import {
  classifyRentalCommissionLiveState,
  rentalCommissionSurfacesInProductUx,
  type CommissionParentContext,
} from "@/lib/finance/rentalCommissionEntitlement";

export type ImplementerCommissionTab = "all" | "rental" | "hosting" | "marketing" | "project";

export type ImplementerCommissionSourceType =
  | "rental"
  | "hosting"
  | "marketing"
  | "project"
  | "task"
  | "legacy"
  | "other";

export type ImplementerCommissionViewRow = {
  id: string;
  sourceType: ImplementerCommissionSourceType;
  sourceLabel: string;
  sourceTitle: string;
  customerName: string | null;
  potentialAmount: number;
  paidAmount: number;
  remainingAmount: number;
  payoutStatus: DealPayoutStatus;
  payoutHistory: PayoutTransaction[];
  workflowPaidUnaudited: boolean;
  linkedSourceId: string | null;
  linkedSourceTable: string | null;
  commissionId: string | null;
  sortDate: string;
  note: string | null;
  paymentForm: string | null;
};

export const IMPLEMENTER_COMMISSION_TAB_LABELS: Record<ImplementerCommissionTab, string> = {
  all: "Všetky",
  rental: "Prenájmy",
  hosting: "Hosting",
  marketing: "Marketing",
  project: "Projekty",
};

export function mapCommissionSourceType(
  sourceType: string | null | undefined,
): ImplementerCommissionSourceType {
  switch (sourceType) {
    case "rental":
    case "hosting":
    case "marketing":
    case "project":
    case "task":
      return sourceType;
    case "other":
      return "other";
    default:
      return "legacy";
  }
}

function rentalDealToViewRow(deal: RentalCommissionDeal, sortDate: string): ImplementerCommissionViewRow {
  const isHistoricalRental = deal.dealType === "historical_rental";
  return {
    id: deal.commissionId ?? deal.dealKey,
    sourceType: deal.dealType === "legacy" ? "legacy" : "rental",
    sourceLabel: isHistoricalRental
      ? `${COMMISSION_SOURCE_LABELS.rental} (historické)`
      : deal.dealType === "legacy"
        ? "Legacy"
        : COMMISSION_SOURCE_LABELS.rental,
    sourceTitle: deal.title,
    customerName: deal.clientName,
    potentialAmount: deal.potentialCommission,
    paidAmount: deal.paidAmount,
    remainingAmount: deal.remainingAmount,
    payoutStatus: deal.payoutStatus,
    payoutHistory: deal.payoutTransactions,
    workflowPaidUnaudited: deal.workflowPaidUnaudited,
    linkedSourceId: deal.websiteId ?? deal.commissionId ?? null,
    linkedSourceTable: deal.websiteId ? "rental_websites" : deal.commissionId ? "commissions" : null,
    commissionId: deal.commissionId ?? null,
    sortDate,
    note: deal.note || null,
    paymentForm: deal.paymentForm || null,
  };
}

function commissionToViewRow(c: CommissionRow, payoutRecords: PayoutRecordLike[]): ImplementerCommissionViewRow {
  const potentialAmount = Number(c.amount) || 0;
  const payoutHistory = payoutTransactionsForCommission(c.id, payoutRecords);
  const paidAmount = sumPayoutTransactions(payoutHistory);
  const sourceType = mapCommissionSourceType(c.source_type);
  const typeKey = (c.source_type as CommissionSourceType) || "other";
  const sourceLabel =
    sourceType === "legacy"
      ? "Legacy"
      : COMMISSION_SOURCE_LABELS[typeKey as CommissionSourceType] ?? String(c.source_type ?? "Legacy");

  return {
    id: c.id,
    sourceType,
    sourceLabel,
    sourceTitle: c.title,
    customerName: c.customer_email ?? null,
    potentialAmount,
    paidAmount,
    remainingAmount: computeDealRemaining(potentialAmount, paidAmount),
    payoutStatus: deriveDealPayoutStatus(potentialAmount, paidAmount),
    payoutHistory,
    workflowPaidUnaudited: paidAmount <= 0 && c.payment_status === "paid",
    linkedSourceId: c.source_id ?? null,
    linkedSourceTable: c.source_id ? "commissions" : null,
    commissionId: c.id,
    sortDate: c.date,
    note: c.note,
    paymentForm: (c.payment_form as string) || null,
  };
}

type BuildOpts = {
  implementer: string;
  year: number;
  commissions: CommissionRow[];
  payoutRecords: PayoutRecordLike[];
  websites: Array<{
    id: string;
    name?: string | null;
    client_name?: string | null;
    monthly_price?: number | null;
    implementers?: unknown;
  }>;
  payments: Array<{
    website_id: string;
    year: number;
    month: number;
    status?: string | null;
    paid?: boolean | null;
    custom_price?: number | null;
    amount?: number | null;
  }>;
  parents?: CommissionParentContext;
};

/** One normalized row per commission/deal — rentals merged, no duplicates. */
export function buildImplementerCommissionViewRows(opts: BuildOpts): ImplementerCommissionViewRow[] {
  const name = opts.implementer.trim().toLowerCase();
  const yearStr = String(opts.year);

  const websiteInputs = opts.websites.map((w) => ({
    id: w.id,
    name: String(w.name ?? w.id),
    client_name: w.client_name ?? null,
    implementers: normalizeRentalImplementers(w.implementers),
  }));

  const { rentalDeals, legacyDeals } = buildRentalCommissionDeals({
    implementerName: opts.implementer,
    year: opts.year,
    websites: websiteInputs,
    commissions: opts.commissions,
    payoutRecords: opts.payoutRecords,
    yearStats: (w) =>
      rentalYearStats(
        opts.websites.find((x) => x.id === w.id) ?? { id: w.id, monthly_price: 0 },
        opts.payments,
        opts.year,
      ),
  });

  const commissionById = new Map(
    opts.commissions
      .filter(
        (c) =>
          (c.implementer || "").trim().toLowerCase() === name &&
          (c.date || "").startsWith(yearStr),
      )
      .map((c) => [c.id, c]),
  );

  const consumedIds = new Set<string>();
  const rows: ImplementerCommissionViewRow[] = [];

  for (const deal of rentalDeals) {
    if (deal.commissionId) consumedIds.add(deal.commissionId);
    const sortDate = deal.commissionId
      ? commissionById.get(deal.commissionId)?.date ?? `${opts.year}-12-31`
      : `${opts.year}-12-31`;
    rows.push(rentalDealToViewRow(deal, sortDate));
  }

  for (const deal of legacyDeals) {
    if (deal.commissionId) consumedIds.add(deal.commissionId);
    const sortDate = deal.commissionId
      ? commissionById.get(deal.commissionId)?.date ?? `${opts.year}-12-31`
      : `${opts.year}-12-31`;
    rows.push(rentalDealToViewRow(deal, sortDate));
  }

  for (const c of commissionById.values()) {
    if (consumedIds.has(c.id)) continue;
    if (c.source_type === "rental") continue;
    if (opts.parents) {
      const liveState = classifyRentalCommissionLiveState(
        c,
        websiteInputs,
        opts.payoutRecords,
        opts.parents,
      );
      if (!rentalCommissionSurfacesInProductUx(liveState)) continue;
    }
    rows.push(commissionToViewRow(c, opts.payoutRecords));
  }

  return rows.sort((a, b) => {
    const dt = b.sortDate.localeCompare(a.sortDate);
    return dt !== 0 ? dt : b.id.localeCompare(a.id);
  });
}

export function filterImplementerCommissionRowsByTab(
  rows: ImplementerCommissionViewRow[],
  tab: ImplementerCommissionTab,
): ImplementerCommissionViewRow[] {
  if (tab === "all") return rows;
  return rows.filter((r) => r.sourceType === tab);
}

export function summarizeImplementerCommissionViewRows(rows: ImplementerCommissionViewRow[]): {
  count: number;
  potential: number;
  paid: number;
  remaining: number;
  statusCounts: Record<DealPayoutStatus, number>;
} {
  const statusCounts: Record<DealPayoutStatus, number> = {
    unpaid: 0,
    partially_paid: 0,
    paid: 0,
    overpaid: 0,
  };
  const totals = rows.reduce(
    (acc, r) => {
      statusCounts[r.payoutStatus] += 1;
      return {
        count: acc.count + 1,
        potential: acc.potential + r.potentialAmount,
        paid: acc.paid + r.paidAmount,
        remaining: acc.remaining + r.remainingAmount,
      };
    },
    { count: 0, potential: 0, paid: 0, remaining: 0 },
  );
  return { ...totals, statusCounts };
}
