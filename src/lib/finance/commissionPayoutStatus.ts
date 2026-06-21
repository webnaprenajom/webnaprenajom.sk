/**
 * Commission payout status — Fáza 5 "Commission Clarity".
 *
 * Distinguishes the workflow flag (`commissions.payment_status`) from the
 * audited truth (`payout_records` with `source_table='commissions'`).
 * See AUDIT_FINDINGS.md / ROADMAP.md Fáza 5 for the full mapping.
 *
 * Truth ordering (CLAUDE.md): *_fact (zelená) > legacy_import (oranžová) > workflow_only (sivá).
 * This module never recalculates `commissions.amount` or writes payouts —
 * it only classifies existing rows for display.
 */
import type { FinanceTruthLevel } from "./types";
import {
  classifyRentalCommissionLiveState,
  commissionLinkedPayoutSurfacesInProductUx,
  rentalCommissionSurfacesInProductUx,
  type RentalWebsiteEntitlementInput,
} from "@/lib/finance/rentalCommissionEntitlement";

export type CommissionPayoutStatus =
  | "unpaid_workflow"
  | "paid_workflow_unaudited"
  | "audited_payout_fact"
  | "audited_legacy_import";

export interface CommissionLike {
  id: string;
  payment_status: string | null;
}

export interface PayoutRecordLike {
  id?: string;
  source_table: string | null;
  source_id: string | null;
  amount: number | null;
  paid_at: string;
  truth_level: string | null;
  note?: string | null;
  reference?: string | null;
}

export interface CommissionPayoutInfo {
  status: CommissionPayoutStatus;
  /** Sum of linked payout_records amounts (0 if none). */
  auditedAmount: number;
  /** Most recent paid_at among linked payout_records, or null. */
  auditedPaidAt: string | null;
  /** Truth level of the linked payout_records (payout_fact wins over legacy_import). */
  truthLevel: FinanceTruthLevel | null;
  /** Number of linked payout_records rows (normally 0 or 1). */
  recordCount: number;
}

/**
 * Resolve the audited-vs-workflow payout status for one commission row.
 *
 * - `unpaid_workflow`: payment_status='unpaid' and no linked payout_records.
 * - `paid_workflow_unaudited`: payment_status='paid' but no linked payout_records —
 *   the "vyplatené" flag is a workflow note only, not an audited fact.
 * - `audited_payout_fact` / `audited_legacy_import`: a payout_records row with
 *   source_table='commissions' AND source_id=commission.id exists — this is the
 *   canonical "paid" truth regardless of payment_status.
 */
export function resolveCommissionPayoutInfo(
  commission: CommissionLike,
  payoutRecords: PayoutRecordLike[],
): CommissionPayoutInfo {
  const linked = payoutRecords.filter(
    (r) => r.source_table === "commissions" && r.source_id === commission.id,
  );

  if (linked.length === 0) {
    return {
      status: commission.payment_status === "paid" ? "paid_workflow_unaudited" : "unpaid_workflow",
      auditedAmount: 0,
      auditedPaidAt: null,
      truthLevel: null,
      recordCount: 0,
    };
  }

  const hasFact = linked.some((r) => r.truth_level === "payout_fact");
  const truthLevel: FinanceTruthLevel = hasFact ? "payout_fact" : "legacy_import";
  const auditedAmount = linked.reduce((s, r) => s + Number(r.amount || 0), 0);
  const auditedPaidAt =
    linked
      .map((r) => r.paid_at)
      .filter(Boolean)
      .sort()
      .slice(-1)[0] ?? null;

  return {
    status: hasFact ? "audited_payout_fact" : "audited_legacy_import",
    auditedAmount,
    auditedPaidAt,
    truthLevel,
    recordCount: linked.length,
  };
}

export const COMMISSION_PAYOUT_STATUS_LABELS: Record<CommissionPayoutStatus, string> = {
  unpaid_workflow: "Nevyplatené (interný stav)",
  paid_workflow_unaudited: "Vyplatené (workflow) — neauditované",
  audited_payout_fact: "Auditovaná výplata",
  audited_legacy_import: "Auditovaná výplata (legacy import)",
};

export interface CommissionPayoutTotals {
  /** payment_status='unpaid' and no audited payout. */
  unpaidWorkflow: number;
  /** payment_status='paid' but no audited payout — workflow note only. */
  paidWorkflowUnaudited: number;
  /** Sum of audited payout_records amounts (payout_fact + legacy_import), regardless of payment_status. */
  auditedTotal: number;
  /** Audited total split by truth level, for badge breakdowns. */
  auditedFact: number;
  auditedLegacyImport: number;
}

/**
 * "Paid vs not yet paid" breakdown without mixing workflow and audited payouts
 * (Fáza 5, task 4). Each commission contributes to exactly one workflow bucket
 * (unpaidWorkflow XOR paidWorkflowUnaudited when unaudited) AND, independently,
 * to auditedTotal if a payout_records row exists.
 */
export function summarizeCommissionPayoutTotals(
  commissions: CommissionLike[],
  payoutRecords: PayoutRecordLike[],
): CommissionPayoutTotals {
  const totals: CommissionPayoutTotals = {
    unpaidWorkflow: 0,
    paidWorkflowUnaudited: 0,
    auditedTotal: 0,
    auditedFact: 0,
    auditedLegacyImport: 0,
  };

  for (const c of commissions) {
    const info = resolveCommissionPayoutInfo(c, payoutRecords);
    const amount = Number((c as unknown as { amount?: number }).amount || 0);
    switch (info.status) {
      case "unpaid_workflow":
        totals.unpaidWorkflow += amount;
        break;
      case "paid_workflow_unaudited":
        totals.paidWorkflowUnaudited += amount;
        break;
      case "audited_payout_fact":
        totals.auditedTotal += info.auditedAmount;
        totals.auditedFact += info.auditedAmount;
        break;
      case "audited_legacy_import":
        totals.auditedTotal += info.auditedAmount;
        totals.auditedLegacyImport += info.auditedAmount;
        break;
    }
  }

  return totals;
}

export interface ImplementerFinanceTotals {
  paidAudited: number;
  paidAuditedFact: number;
  paidAuditedLegacy: number;
  paidWorkflowUnaudited: number;
  unpaid: number;
  lineCount: number;
}

/** Vyplatené v implementer pohľade — auditované + workflow bez payoutu, bez dvojitého započítania. */
export function implementerPaidDisplayTotal(totals: ImplementerFinanceTotals): number {
  return totals.paidAudited + totals.paidWorkflowUnaudited;
}

export function resolveImplementerFinanceTruthLevel(
  totals: Pick<ImplementerFinanceTotals, "paidAuditedFact" | "paidAuditedLegacy">,
): FinanceTruthLevel {
  if (totals.paidAuditedFact > 0) return "payout_fact";
  if (totals.paidAuditedLegacy > 0) return "legacy_import";
  return "workflow_only";
}

/**
 * Per-implementer totals: payout_records majú prednosť pre „vyplatené“,
 * workflow commission suma len ak linked payout neexistuje.
 */
export function implementerTotalsFromCommissionPayouts(
  commissions: Array<CommissionLike & { implementer?: string | null; amount?: number | null }>,
  payoutRecords: Array<PayoutRecordLike & { implementer?: string | null }>,
  opts?: {
    websites?: readonly RentalWebsiteEntitlementInput[];
    /** Full commission set for orphan payout classification (year filter may omit linked rows). */
    allCommissions?: Array<
      CommissionLike & {
        implementer?: string | null;
        amount?: number | null;
        source_type?: string | null;
        source_id?: string | null;
        payment_status?: string | null;
      }
    >;
  },
): Map<string, ImplementerFinanceTotals> {
  const map = new Map<string, ImplementerFinanceTotals>();
  const commissionIds = new Set(commissions.map((c) => c.id));
  const websites = opts?.websites;
  const commissionsById = new Map(
    (opts?.allCommissions ?? commissions).map((c) => [c.id, c]),
  );

  const bump = (key: string, patch: Partial<ImplementerFinanceTotals>) => {
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
  };

  for (const c of commissions) {
    const key = (c.implementer || "").trim();
    if (!key) continue;

    if (websites) {
      const liveState = classifyRentalCommissionLiveState(
        c as CommissionLike & {
          source_type?: string | null;
          source_id?: string | null;
          payment_status?: string | null;
        },
        websites,
        payoutRecords,
      );
      if (!rentalCommissionSurfacesInProductUx(liveState)) continue;
    }

    const info = resolveCommissionPayoutInfo(c, payoutRecords);
    const amount = Number(c.amount || 0);
    switch (info.status) {
      case "unpaid_workflow":
        bump(key, { unpaid: amount, lineCount: 1 });
        break;
      case "paid_workflow_unaudited":
        bump(key, { paidWorkflowUnaudited: amount, lineCount: 1 });
        break;
      case "audited_payout_fact":
        bump(key, {
          paidAudited: info.auditedAmount,
          paidAuditedFact: info.auditedAmount,
          unpaid: Math.max(amount - info.auditedAmount, 0),
          lineCount: 1,
        });
        break;
      case "audited_legacy_import":
        bump(key, {
          paidAudited: info.auditedAmount,
          paidAuditedLegacy: info.auditedAmount,
          unpaid: Math.max(amount - info.auditedAmount, 0),
          lineCount: 1,
        });
        break;
    }
  }

  // ponytail: commission-linked payouts without a live product row — audit-only (deleted/revoked source)
  for (const p of payoutRecords) {
    if (p.source_table === "commissions" && p.source_id && commissionIds.has(p.source_id)) {
      continue;
    }
    if (
      p.source_table === "commissions" &&
      !commissionLinkedPayoutSurfacesInProductUx(p, commissionsById, websites ?? [], payoutRecords)
    ) {
      continue;
    }
    const key = (p.implementer || "").trim();
    if (!key) continue;
    const amount = Number(p.amount || 0);
    if (amount <= 0) continue;
    const isFact = p.truth_level === "payout_fact";
    bump(key, {
      paidAudited: amount,
      paidAuditedFact: isFact ? amount : 0,
      paidAuditedLegacy: isFact ? 0 : amount,
      lineCount: 1,
    });
  }

  return map;
}
