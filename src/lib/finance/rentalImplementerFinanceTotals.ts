/**
 * Read-side rental implementer totals for Finance — merges JSON-derived shares
 * (rental_websites.implementers × client-paid months) into commission/payout totals.
 * ponytail: skips rows already materialized in commissions; no writes, no new truth model.
 */
import type { CommissionRow } from "@/lib/commissionSource";
import { normalizeRentalImplementers } from "@/lib/rentalImplementers";
import { findRentalWorkflowCommission } from "@/lib/finance/rentalCommissionPayoutBridge";
import {
  implementerTotalsFromCommissionPayouts,
  type ImplementerFinanceTotals,
} from "@/lib/finance/commissionPayoutStatus";

type RentalPaymentRow = {
  website_id: string;
  year: number;
  month: number;
  status?: string | null;
  paid?: boolean | null;
  custom_price?: number | null;
  amount?: number | null;
};

type RentalWebsiteRow = {
  id: string;
  monthly_price?: number | null;
  implementers?: unknown;
};

function bumpImplementerTotals(
  map: Map<string, ImplementerFinanceTotals>,
  key: string,
  patch: Partial<ImplementerFinanceTotals>,
) {
  const cur: ImplementerFinanceTotals = map.get(key) ?? {
    paidAudited: 0,
    paidAuditedFact: 0,
    paidAuditedLegacy: 0,
    paidWorkflowUnaudited: 0,
    unpaid: 0,
    lineCount: 0,
  };
  map.set(key, {
    paidAudited: cur.paidAudited + (patch.paidAudited ?? 0),
    paidAuditedFact: cur.paidAuditedFact + (patch.paidAuditedFact ?? 0),
    paidAuditedLegacy: cur.paidAuditedLegacy + (patch.paidAuditedLegacy ?? 0),
    paidWorkflowUnaudited: cur.paidWorkflowUnaudited + (patch.paidWorkflowUnaudited ?? 0),
    unpaid: cur.unpaid + (patch.unpaid ?? 0),
    lineCount: cur.lineCount + (patch.lineCount ?? 0),
  });
}

/** Client-paid rental revenue for one website+year (same formula as AdminRentals.yearStats). */
export function rentalYearClientPaidTotal(
  website: RentalWebsiteRow,
  payments: RentalPaymentRow[],
  year: number,
): number {
  let paid = 0;
  for (let m = 1; m <= 12; m++) {
    const p = payments.find((row) => row.website_id === website.id && row.year === year && row.month === m);
    const price = p?.custom_price != null ? Number(p.custom_price) : Number(website.monthly_price || 0);
    const amt = Number(p?.amount ?? price);
    const st = (p?.status as string) || (p?.paid ? "paid" : "none");
    if (st === "paid") paid += amt;
  }
  return paid;
}

export function mergeRentalJsonIntoImplementerTotals(
  base: Map<string, ImplementerFinanceTotals>,
  opts: {
    websites: RentalWebsiteRow[];
    payments: RentalPaymentRow[];
    commissions: CommissionRow[];
    year: number;
    /** When set (administrator scope), only this implementer — case-insensitive. */
    scopeImplementer?: string | null;
  },
): Map<string, ImplementerFinanceTotals> {
  const map = new Map(base);
  const scope = opts.scopeImplementer?.trim().toLowerCase();

  for (const website of opts.websites) {
    const clientPaid = rentalYearClientPaidTotal(website, opts.payments, opts.year);
    if (clientPaid <= 0) continue;

    for (const imp of normalizeRentalImplementers(website.implementers)) {
      const pct = Number(imp.percentage) || 0;
      const key = imp.name.trim();
      if (!key || pct <= 0) continue;
      if (scope && key.toLowerCase() !== scope) continue;

      if (
        findRentalWorkflowCommission(opts.commissions, {
          websiteId: website.id,
          implementer: key,
          year: opts.year,
        })
      ) {
        continue;
      }

      const amount = (clientPaid * pct) / 100;
      if (amount <= 0) continue;

      if (imp.payment_status === "paid") {
        bumpImplementerTotals(map, key, { paidWorkflowUnaudited: amount, lineCount: 1 });
      } else {
        bumpImplementerTotals(map, key, { unpaid: amount, lineCount: 1 });
      }
    }
  }

  return map;
}

export function buildImplementerFinanceTotalsWithRentals(
  commissions: Array<{ id: string; implementer?: string | null; amount?: number | null; payment_status?: string | null }>,
  payoutRecords: Array<{
    source_table?: string | null;
    source_id?: string | null;
    amount?: number | null;
    paid_at: string;
    truth_level?: string | null;
    implementer?: string | null;
  }>,
  opts: {
    websites: RentalWebsiteRow[];
    payments: RentalPaymentRow[];
    allCommissions: CommissionRow[];
    year: number;
    scopeImplementer?: string | null;
  },
): Map<string, ImplementerFinanceTotals> {
  const base = implementerTotalsFromCommissionPayouts(commissions, payoutRecords);
  return mergeRentalJsonIntoImplementerTotals(base, {
    websites: opts.websites,
    payments: opts.payments,
    commissions: opts.allCommissions,
    year: opts.year,
    scopeImplementer: opts.scopeImplementer,
  });
}
