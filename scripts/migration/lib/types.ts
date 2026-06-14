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

export type MigrationReport = {
  batchKey: string;
  dryRun: boolean;
  dir: string;
  startedAt: string;
  finishedAt: string;
  importStats: ImportStats[];
  analysis: {
    uuidCollisions: ReviewItem[];
    duplicateEmailGroups: Array<{ email: string; legacyIds: string[]; sourceFile: string }>;
    customerMatchHints: ReviewItem[];
    orphanFkRisks: ReviewItem[];
    sensitivePayloads: ReviewItem[];
    reviewSummary: Record<ReviewReason, number>;
  };
  totals: {
    rowsParsed: number;
    rowsStaged: number;
    reviewItems: number;
    financeRowsStaged: number;
  };
};
