/** Phase 2C compatibility types — canonical facts + legacy workflow sources. */

import type { EntityPaymentTotals } from "./financeSourceLabels";

export type FinanceRowKind =
  | "commission"
  | "expense"
  | "rental_receivable"
  | "rental_credit_cost"
  | "payment_in"
  | "payout_out"
  | "cost_out";

/**
 * Trust ordering (highest first): *_fact > legacy_import > workflow_only > derived
 */
export type FinanceTruthLevel =
  | "payment_fact"
  | "payout_fact"
  | "cost_fact"
  | "legacy_import"
  | "workflow_only"
  | "derived";

export interface FinanceLedgerRow {
  id: string;
  kind: FinanceRowKind;
  date: string;
  title: string;
  amount: number;
  currency: "EUR";
  direction: "in" | "out";
  statusLabel: string;
  truthLevel: FinanceTruthLevel;
  sourceTable: string;
  sourceId: string;
  category: string | null;
  counterparty: string | null;
  note: string | null;
  clientName: string | null;
  implementer: string | null;
  year: number | null;
  month: number | null;
  /** CRM entity origin when fact row is linked via source_table/source_id on the record */
  linkedOriginTable?: string | null;
  linkedOriginId?: string | null;
  linkedOriginLabel?: string | null;
  linkedOriginSublabel?: string | null;
}

export interface FinanceSnapshotMeta {
  generatedAt: string;
  truthDisclaimer: string;
  sources: string[];
  paymentRecordCount: number;
  payoutRecordCount: number;
  costRecordCount: number;
}

export interface FinanceSnapshotTotals {
  paymentsConfirmed: number;
  paymentsLegacyImport: number;
  payoutsConfirmed: number;
  payoutsLegacyImport: number;
  costsConfirmed: number;
  costsLegacyImport: number;
  workflowOnlyIn: number;
  workflowOnlyOut: number;
  rentalMarkedInvoiced: number;
  rentalMarkedUnpaid: number;
  rentalPotential: number;
  rentalCreditsCostDerived: number;
  /** payment_fact only — grouped by entity-linked source_table */
  entityPaymentsConfirmed: EntityPaymentTotals;
}

export interface ReconciliationSummaryCounts {
  workflowIncoming: number;
  workflowOutgoing: number;
  entityMissingPayment: number;
  entityPartialPayment: number;
  taskPaymentGaps: number;
  entityWorkflowMismatch: number;
  legacyNoReference: number;
  legacyImprecisePaidAt: number;
  missingCounterparty: number;
  potentialDuplicates: number;
  totalIssues: number;
}

export type ReconciliationIssueKind =
  | "workflow_incoming"
  | "workflow_outgoing_commission"
  | "workflow_outgoing_expense"
  | "entity_missing_payment_fact"
  | "entity_partial_payment"
  | "task_missing_payment_deposit"
  | "task_missing_payment_full"
  | "entity_payment_ahead_of_workflow"
  | "legacy_no_reference"
  | "legacy_imprecise_paid_at"
  | "missing_counterparty"
  | "potential_duplicate";

export interface ReconciliationIssue {
  kind: ReconciliationIssueKind;
  severity: "info" | "warn";
  title: string;
  detail: string;
  amount?: number;
  sourceTable?: string;
  sourceId?: string;
  recordId?: string;
  /** Stable key for dismissal matching */
  issueKey?: string;
}

export interface FinanceSnapshot {
  meta: FinanceSnapshotMeta;
  rows: FinanceLedgerRow[];
  totals: FinanceSnapshotTotals;
  reconciliation: {
    counts: ReconciliationSummaryCounts;
    issues: ReconciliationIssue[];
  };
}

/** Operatívny návrh — nie účtovný fakt. */
export interface SettlementDraft {
  implementer: string;
  periodLabel: string;
  year: number;
  month: number;
  commissionCount: number;
  payoutFactCount: number;
  legacyImportAmount: number;
  confirmedPayoutAmount: number;
  workflowOnlyAmount: number;
  suggestedGap: number;
  warnings: string[];
  /** Advisory preview — project stream default for implementer row */
  effectiveRatePreview?: number;
  rateSourceLabel?: string;
  syncHints?: string[];
  pendingCommissions: Array<{
    id: string;
    title: string;
    amount: number;
    date: string;
    effectiveRate?: number;
    rateSourceLabel?: string;
  }>;
}
