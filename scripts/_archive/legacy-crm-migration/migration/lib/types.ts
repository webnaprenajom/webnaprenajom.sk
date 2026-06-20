export type ReviewReason =
  | "uuid_collision"
  | "duplicate_email"
  | "ambiguous_customer_match"
  | "orphan_fk"
  | "sensitive_payload"
  | "missing_legacy_id"
  | "missing_email";

export type ReviewItem = {
  entityType: string;
  legacyId: string | null;
  sourceFile: string;
  reason: ReviewReason;
  detail: string;
  candidates?: unknown[];
};

export type ParsedCsvRow = Record<string, string>;

export type StagedRow = {
  sourceFile: string;
  entityType: string;
  legacyId: string;
  rowHash: string;
  payload: ParsedCsvRow;
};

export type ImportStats = {
  sourceFile: string;
  entityType: string;
  rowsParsed: number;
  inserted: number;
  updated: number;
  unchanged: number;
  skipped: number;
  errors: string[];
};

export type ReconciliationSummary = {
  promotePlan: Array<{
    sourceFile: string;
    entityType: string;
    rowCount: number;
    promotePolicy: string;
    stagingTable: string;
  }>;
  identityGaps: ReviewItem[];
  factLayer: {
    paymentRecords: number;
    costRecords: number;
    payoutRecords: number;
    derivedFromWorkflowInExport: number;
    rule: string;
  };
  workflowFinance: {
    commissions: number;
    rentalPayments: number;
    expenses: number;
  };
  manualOnly: Array<{ sourceFile: string; rowCount: number; note: string }>;
  exportCustomerEmailDupes: Array<{ email: string; legacyIds: string[] }>;
  crossEmailCustomerLeadMismatches: ReviewItem[];
};

export type MigrationReport = {
  batchKey: string;
  dryRun: boolean;
  dir: string;
  targetProjectRef: string;
  startedAt: string;
  finishedAt: string;
  importStats: ImportStats[];
  analysis: {
    uuidCollisions: ReviewItem[];
    duplicateEmailGroups: Array<{ email: string; legacyIds: string[]; sourceFile: string }>;
    customerMatchHints: ReviewItem[];
    orphanFkRisks: ReviewItem[];
    sensitivePayloads: ReviewItem[];
    reviewSummary: Record<string, number>;
    customerEmailCollisions?: ReviewItem[];
  };
  reconciliation?: ReconciliationSummary;
  totals: {
    rowsParsed: number;
    rowsStaged: number;
    reviewItems: number;
    financeRowsStaged: number;
    wouldPromote: number;
    wouldSkip: number;
    manualReview: number;
  };
};
