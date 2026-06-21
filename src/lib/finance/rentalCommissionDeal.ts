/**
 * Canonical rental implementer commission deal — one row per rental+implementer+year
 * (or legacy commission), with payout ledger math shared by Rentals + Finance.
 */
import type { CommissionRow } from "@/lib/commissionSource";
import { bucketCommissionsBySection } from "@/lib/commissionFilters";
import { findRentalWorkflowCommission } from "@/lib/finance/rentalCommissionPayoutBridge";
import { normalizeRentalImplementers, type RentalImplementerPaymentStatus } from "@/lib/rentalImplementers";
import type { PayoutRecordLike } from "@/lib/finance/commissionPayoutStatus";
import {
  classifyRentalCommissionLiveState,
  rentalCommissionSurfacesInProductUx,
} from "@/lib/finance/rentalCommissionEntitlement";

export type DealPayoutStatus = "unpaid" | "partially_paid" | "paid" | "overpaid";

export type PayoutTransaction = {
  id: string;
  amount: number;
  paid_at: string;
  truth_level: string | null;
  note: string | null;
  reference: string | null;
};

export type RentalCommissionDeal = {
  dealKey: string;
  dealType: "rental" | "legacy" | "historical_rental";
  websiteId?: string;
  commissionId?: string;
  title: string;
  clientName: string | null;
  percentage?: number;
  /** Podiel z uhradených mesiacov klienta (rental economics). */
  clientPaidShare?: number;
  potentialCommission: number;
  paidAmount: number;
  remainingAmount: number;
  payoutStatus: DealPayoutStatus;
  /** Workflow flag bez auditovanej výplaty — diagnostika legacy. */
  workflowPaidUnaudited: boolean;
  paymentForm: string;
  note: string;
  lastPayoutAt: string | null;
  payoutTransactions: PayoutTransaction[];
  /** Index v rental_websites.implementers — len pre rental JSON edit. */
  impIndex?: number;
  /** Materializovaná provízia existuje popri JSON podiele (pred merge). */
  hadDualSource?: boolean;
};

export const DEAL_PAYOUT_STATUS_LABELS: Record<DealPayoutStatus, string> = {
  unpaid: "Nevyplatené",
  partially_paid: "Čiastočne vyplatené",
  paid: "Vyplatené",
  overpaid: "Preplatené (audit)",
};

const DEAL_STATUS_CLASS: Record<DealPayoutStatus, string> = {
  unpaid: "border-amber-500/40 text-amber-600",
  partially_paid: "border-blue-500/40 text-blue-600",
  paid: "border-green-500/40 text-green-600",
  overpaid: "border-red-500/40 text-red-600",
};

export function dealPayoutStatusClass(status: DealPayoutStatus): string {
  return DEAL_STATUS_CLASS[status];
}

export function rentalDealKey(websiteId: string, year: number): string {
  return `rental:${websiteId}:${year}`;
}

/** Derive payout status from audited payout sum vs potential commission. */
export function deriveDealPayoutStatus(potential: number, paid: number): DealPayoutStatus {
  const pot = Math.max(Number(potential) || 0, 0);
  const pd = Math.max(Number(paid) || 0, 0);
  if (pd <= 0) return "unpaid";
  if (pd > pot) return "overpaid";
  if (pd < pot) return "partially_paid";
  return "paid";
}

export function computeDealRemaining(potential: number, paid: number): number {
  return Math.max((Number(potential) || 0) - (Number(paid) || 0), 0);
}

export function payoutTransactionsForCommission(
  commissionId: string | undefined,
  payoutRecords: PayoutRecordLike[],
): PayoutTransaction[] {
  if (!commissionId) return [];
  return payoutRecords
    .filter((r) => r.source_table === "commissions" && r.source_id === commissionId)
    .map((r) => ({
      id: r.id ?? `${r.paid_at}:${r.amount}`,
      amount: Number(r.amount || 0),
      paid_at: r.paid_at,
      truth_level: r.truth_level,
      note: r.note ?? null,
      reference: r.reference ?? null,
    }))
    .sort((a, b) => b.paid_at.localeCompare(a.paid_at));
}

export function sumPayoutTransactions(transactions: PayoutTransaction[]): number {
  return transactions.reduce((s, t) => s + t.amount, 0);
}

type WebsiteInput = {
  id: string;
  name: string;
  client_name: string | null;
  implementers: Array<{
    name: string;
    percentage: number;
    payment_status?: RentalImplementerPaymentStatus;
    payment_form?: string | null;
    note?: string | null;
  }>;
};

type YearStatsFn = (w: WebsiteInput) => { paid: number; potential: number };

function buildRentalDealRow(opts: {
  website: WebsiteInput;
  impIndex: number;
  implementerName: string;
  year: number;
  yearStats: YearStatsFn;
  commissions: CommissionRow[];
  payoutRecords: PayoutRecordLike[];
}): RentalCommissionDeal | null {
  const imp = opts.website.implementers[opts.impIndex];
  const pct = Number(imp.percentage) || 0;
  if (pct <= 0) return null;

  const stats = opts.yearStats(opts.website);
  const clientPaidShare = (stats.paid * pct) / 100;
  const potentialCommission = (stats.potential * pct) / 100;
  if (potentialCommission <= 0 && clientPaidShare <= 0) return null;

  const commission = findRentalWorkflowCommission(opts.commissions, {
    websiteId: opts.website.id,
    implementer: opts.implementerName,
    year: opts.year,
  });

  const payoutTransactions = payoutTransactionsForCommission(commission?.id, opts.payoutRecords);
  const paidAmount = sumPayoutTransactions(payoutTransactions);
  const remainingAmount = computeDealRemaining(potentialCommission, paidAmount);
  const payoutStatus = deriveDealPayoutStatus(potentialCommission, paidAmount);

  const jsonWorkflowPaid = imp.payment_status === "paid";
  const commWorkflowPaid = commission?.payment_status === "paid";
  const workflowPaidUnaudited =
    paidAmount <= 0 && (jsonWorkflowPaid || commWorkflowPaid);

  const lastPayoutAt = payoutTransactions[0]?.paid_at ?? null;

  return {
    dealKey: rentalDealKey(opts.website.id, opts.year),
    dealType: "rental",
    websiteId: opts.website.id,
    commissionId: commission?.id,
    title: opts.website.name,
    clientName: opts.website.client_name,
    percentage: pct,
    clientPaidShare,
    potentialCommission,
    paidAmount,
    remainingAmount,
    payoutStatus,
    workflowPaidUnaudited,
    paymentForm: (imp.payment_form as string) || (commission?.payment_form as string) || "",
    note: imp.note || commission?.note || "",
    lastPayoutAt,
    payoutTransactions,
    impIndex: opts.impIndex,
    hadDualSource: !!commission,
  };
}

function buildHistoricalRentalDealRow(
  c: CommissionRow,
  payoutRecords: PayoutRecordLike[],
): RentalCommissionDeal {
  const payoutTransactions = payoutTransactionsForCommission(c.id, payoutRecords);
  const paidAmount = sumPayoutTransactions(payoutTransactions);
  const recordedPotential = Number(c.amount) || 0;

  return {
    dealKey: `historical-rental:${c.id}`,
    dealType: "historical_rental",
    commissionId: c.id,
    websiteId: c.source_id ?? undefined,
    title: c.title,
    clientName: c.customer_email ?? null,
    potentialCommission: paidAmount > 0 ? paidAmount : recordedPotential,
    paidAmount,
    remainingAmount: 0,
    payoutStatus: paidAmount > 0 ? "paid" : "unpaid",
    workflowPaidUnaudited: false,
    paymentForm: (c.payment_form as string) || "",
    note: c.note || "",
    lastPayoutAt: payoutTransactions[0]?.paid_at ?? null,
    payoutTransactions,
  };
}

function buildLegacyDealRow(
  c: CommissionRow,
  payoutRecords: PayoutRecordLike[],
): RentalCommissionDeal {
  const potentialCommission = Number(c.amount) || 0;
  const payoutTransactions = payoutTransactionsForCommission(c.id, payoutRecords);
  const paidAmount = sumPayoutTransactions(payoutTransactions);
  const remainingAmount = computeDealRemaining(potentialCommission, paidAmount);

  return {
    dealKey: `legacy:${c.id}`,
    dealType: "legacy",
    commissionId: c.id,
    title: c.title,
    clientName: c.customer_email ?? null,
    potentialCommission,
    paidAmount,
    remainingAmount,
    payoutStatus: deriveDealPayoutStatus(potentialCommission, paidAmount),
    workflowPaidUnaudited: paidAmount <= 0 && c.payment_status === "paid",
    paymentForm: (c.payment_form as string) || "",
    note: c.note || "",
    lastPayoutAt: payoutTransactions[0]?.paid_at ?? null,
    payoutTransactions,
  };
}

/** One canonical deal per rental website share; legacy commissions listed separately. */
export function buildRentalCommissionDeals(opts: {
  implementerName: string;
  year: number;
  websites: WebsiteInput[];
  commissions: CommissionRow[];
  payoutRecords: PayoutRecordLike[];
  yearStats: YearStatsFn;
}): { rentalDeals: RentalCommissionDeal[]; legacyDeals: RentalCommissionDeal[] } {
  const name = opts.implementerName.trim().toLowerCase();
  const rentalDeals: RentalCommissionDeal[] = [];
  const consumedCommissionIds = new Set<string>();

  for (const w of opts.websites) {
    const idx = (w.implementers || []).findIndex(
      (i) => i.name.trim().toLowerCase() === name,
    );
    if (idx < 0) continue;
    const deal = buildRentalDealRow({
      website: w,
      impIndex: idx,
      implementerName: opts.implementerName,
      year: opts.year,
      yearStats: opts.yearStats,
      commissions: opts.commissions,
      payoutRecords: opts.payoutRecords,
    });
    if (!deal) continue;
    if (deal.commissionId) consumedCommissionIds.add(deal.commissionId);
    rentalDeals.push(deal);
  }

  const yearFiltered = opts.commissions.filter(
    (c) =>
      (c.implementer || "").trim().toLowerCase() === name &&
      (c.date || "").startsWith(String(opts.year)),
  );
  const { section: rentalCommissions, legacy: legacyCommissions } = bucketCommissionsBySection(
    yearFiltered,
    "rental",
  );

  for (const c of rentalCommissions) {
    if (consumedCommissionIds.has(c.id)) continue;
    const liveState = classifyRentalCommissionLiveState(c, opts.websites, opts.payoutRecords);
    if (!rentalCommissionSurfacesInProductUx(liveState)) continue;

    const potentialCommission = Number(c.amount) || 0;
    const payoutTransactions = payoutTransactionsForCommission(c.id, opts.payoutRecords);
    const paidAmount = sumPayoutTransactions(payoutTransactions);
    rentalDeals.push({
      dealKey: `commission:${c.id}`,
      dealType: "rental",
      commissionId: c.id,
      title: c.title,
      clientName: c.customer_email ?? null,
      potentialCommission,
      paidAmount,
      remainingAmount: computeDealRemaining(potentialCommission, paidAmount),
      payoutStatus: deriveDealPayoutStatus(potentialCommission, paidAmount),
      workflowPaidUnaudited: paidAmount <= 0 && c.payment_status === "paid",
      paymentForm: (c.payment_form as string) || "",
      note: c.note || "",
      lastPayoutAt: payoutTransactions[0]?.paid_at ?? null,
      payoutTransactions,
      websiteId: c.source_id ?? undefined,
    });
  }

  const legacyDeals = legacyCommissions
    .map((c) => buildLegacyDealRow(c, opts.payoutRecords))
    .sort((a, b) => b.potentialCommission - a.potentialCommission);

  rentalDeals.sort((a, b) => b.potentialCommission - a.potentialCommission);

  return { rentalDeals, legacyDeals };
}

export function summarizeRentalCommissionDeals(deals: RentalCommissionDeal[]): {
  count: number;
  potential: number;
  paid: number;
  remaining: number;
} {
  return deals.reduce(
    (acc, d) => ({
      count: acc.count + 1,
      potential: acc.potential + d.potentialCommission,
      paid: acc.paid + d.paidAmount,
      remaining: acc.remaining + d.remainingAmount,
    }),
    { count: 0, potential: 0, paid: 0, remaining: 0 },
  );
}

/** Group canonical deals into implementer finance buckets (no double counting). */
export function canonicalDealsToImplementerTotals(
  deals: RentalCommissionDeal[],
  implementerName: string,
): {
  paidAudited: number;
  paidAuditedFact: number;
  paidAuditedLegacy: number;
  paidWorkflowUnaudited: number;
  unpaid: number;
  lineCount: number;
} {
  const totals = {
    paidAudited: 0,
    paidAuditedFact: 0,
    paidAuditedLegacy: 0,
    paidWorkflowUnaudited: 0,
    unpaid: 0,
    lineCount: 0,
  };

  for (const d of deals) {
    totals.lineCount += 1;
    totals.paidAudited += d.paidAmount;
    for (const t of d.payoutTransactions) {
      if (t.truth_level === "payout_fact") totals.paidAuditedFact += t.amount;
      else totals.paidAuditedLegacy += t.amount;
    }
    totals.unpaid += d.remainingAmount;
    if (d.workflowPaidUnaudited) {
      totals.paidWorkflowUnaudited += d.potentialCommission;
    }
  }

  return totals;
}
