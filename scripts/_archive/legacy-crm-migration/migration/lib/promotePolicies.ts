/** Binding skip / outcome reasons for promote phase */

export type PromoteOutcome =
  | "would_insert"
  | "skip_uuid_collision"
  | "skip_email_collision"
  | "skip_orphan_fk"
  | "skip_ambiguous_identity"
  | "skip_manual_only"
  | "skip_promote_policy"
  | "skip_empty";

export const ORPHAN_LEAD_LOG_POLICY = "skip" as const;
// OPTION A: orphan lead_logs (no matching lead) → staging + review queue only

export const PROMOTE_ORDER = [
  "customers.csv",
  "commission_rules.csv",
  "leads.csv",
  "rental_websites.csv",
  "hosting_records.csv",
  "rental_payments.csv",
  "commissions.csv",
  "payment_records.csv",
  "cost_records.csv",
  "payout_records.csv",
  "expenses.csv",
  "project_notes.csv",
  "tasks.csv",
  "lead_logs.csv",
  "notifications.csv",
  "wheel_spins.csv",
  "design_proposals.csv",
  "communication_events.csv",
] as const;

export type PromotePlanRow = {
  sourceFile: string;
  entityType: string;
  canonicalTable: string;
  legacyId: string;
  outcome: PromoteOutcome;
  detail: string;
  reviewQueue: boolean;
};

import type { PromoteTableEntry } from "./promoteTableRegistry.js";

export type PromotePlanSummary = {
  batchKey: string;
  dryRun: boolean;
  targetProjectRef: string;
  byOutcome: Record<PromoteOutcome, number>;
  bySource: Array<{
    sourceFile: string;
    wouldInsert: number;
    skipped: number;
    reviewQueue: number;
  }>;
  skipReasonsBySource?: Record<string, Partial<Record<PromoteOutcome, number>>>;
  liveCollisions?: {
    uuid: number;
    customerEmail: number;
    uuidSamples: Array<{ sourceFile: string; legacyId: string | null; detail: string }>;
    emailSamples: Array<{ sourceFile: string; legacyId: string | null; detail: string }>;
  };
  tableRegistry?: PromoteTableEntry[];
  rows: PromotePlanRow[];
  userRolesMappingPath?: string;
};
