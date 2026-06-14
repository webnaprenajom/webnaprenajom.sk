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
  source_table: string | null;
  source_id: string | null;
  amount: number | null;
  paid_at: string;
  truth_level: string | null;
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
