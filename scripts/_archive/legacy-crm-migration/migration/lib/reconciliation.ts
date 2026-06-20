import { normalizeEmail } from "./normalizeIdentity.js";
import type { MigrationSourceDef } from "./sources.js";
import { MIGRATION_SOURCES, promotePolicyFor } from "./sources.js";
import type { ReviewItem, StagedRow } from "./types.js";

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

const CUSTOMER_ID_FIELDS: Array<{ sourceFile: string; field: string; entityType: string }> = [
  { sourceFile: "leads.csv", field: "customer_id", entityType: "lead" },
  { sourceFile: "rental_websites.csv", field: "customer_id", entityType: "rental_website" },
  { sourceFile: "hosting_records.csv", field: "customer_id", entityType: "hosting_record" },
  { sourceFile: "commissions.csv", field: "customer_id", entityType: "commission" },
  { sourceFile: "tasks.csv", field: "customer_id", entityType: "task" },
  { sourceFile: "project_notes.csv", field: "customer_id", entityType: "project_note" },
  { sourceFile: "communication_events.csv", field: "customer_id", entityType: "communication_event" },
];

export function buildReconciliation(
  stagedRows: StagedRow[],
  sourceDefs: MigrationSourceDef[] = MIGRATION_SOURCES,
): ReconciliationSummary {
  const bySource = groupBySource(stagedRows);
  const customerIds = bySource.get("customers.csv") ?? new Set<string>();

  const identityGaps: ReviewItem[] = [];
  for (const spec of CUSTOMER_ID_FIELDS) {
    const rows = stagedRows.filter((r) => r.sourceFile === spec.sourceFile);
    for (const row of rows) {
      const cid = (row.payload[spec.field] ?? "").trim();
      if (!cid) {
        identityGaps.push({
          entityType: spec.entityType,
          legacyId: row.legacyId,
          sourceFile: spec.sourceFile,
          reason: "ambiguous_customer_match",
          detail: `Missing ${spec.field} — bridge via email/name on promote`,
        });
        continue;
      }
      if (!customerIds.has(cid)) {
        identityGaps.push({
          entityType: spec.entityType,
          legacyId: row.legacyId,
          sourceFile: spec.sourceFile,
          reason: "orphan_fk",
          detail: `${spec.field}=${cid} not found in export customers.csv`,
          candidates: [{ field: spec.field, value: cid }],
        });
      }
    }
  }

  const paymentRows = stagedRows.filter((r) => r.sourceFile === "payment_records.csv");
  const rentalPaymentIds = bySource.get("rental_payments.csv") ?? new Set<string>();
  const derivedFromWorkflow = paymentRows.filter((r) => {
    const st = (r.payload.source_table ?? "").trim();
    const sid = (r.payload.source_id ?? "").trim();
    return st === "rental_payments" && sid && rentalPaymentIds.has(sid);
  }).length;

  const customerRows = stagedRows.filter((r) => r.sourceFile === "customers.csv");
  const exportCustomerEmailDupes = detectExportCustomerEmailDupes(customerRows);
  const crossEmailCustomerLeadMismatches = detectCrossEmailMismatches(stagedRows, customerRows);

  const promotePlan = sourceDefs.map((def) => {
    const count = stagedRows.filter((r) => r.sourceFile === def.sourceFile).length;
    const policy = promotePolicyFor(def);
    const stagingTable = def.kind === "finance" ? "legacy_finance_staging" : "legacy_import_rows";
    return {
      sourceFile: def.sourceFile,
      entityType: def.entityType,
      rowCount: count,
      promotePolicy: policy,
      stagingTable,
    };
  });

  const manualOnly = sourceDefs
    .filter((d) => promotePolicyFor(d) === "manual")
    .map((d) => ({
      sourceFile: d.sourceFile,
      rowCount: stagedRows.filter((r) => r.sourceFile === d.sourceFile).length,
      note: "Requires auth.users review — never auto-promote",
    }));

  return {
    promotePlan,
    identityGaps,
    factLayer: {
      paymentRecords: countSource(stagedRows, "payment_records.csv"),
      costRecords: countSource(stagedRows, "cost_records.csv"),
      payoutRecords: countSource(stagedRows, "payout_records.csv"),
      derivedFromWorkflowInExport: derivedFromWorkflow,
      rule: "FACT rows imported as-is; do NOT re-derive from workflow when export FACT exists",
    },
    workflowFinance: {
      commissions: countSource(stagedRows, "commissions.csv"),
      rentalPayments: countSource(stagedRows, "rental_payments.csv"),
      expenses: countSource(stagedRows, "expenses.csv"),
    },
    manualOnly,
    exportCustomerEmailDupes,
    crossEmailCustomerLeadMismatches,
  };
}

function groupBySource(rows: StagedRow[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = map.get(row.sourceFile) ?? new Set<string>();
    set.add(row.legacyId);
    map.set(row.sourceFile, set);
  }
  return map;
}

function countSource(rows: StagedRow[], sourceFile: string): number {
  return rows.filter((r) => r.sourceFile === sourceFile).length;
}

function detectExportCustomerEmailDupes(customerRows: StagedRow[]) {
  const byEmail = new Map<string, string[]>();
  for (const row of customerRows) {
    const email = normalizeEmail(row.payload.email);
    if (!email) continue;
    const list = byEmail.get(email) ?? [];
    list.push(row.legacyId);
    byEmail.set(email, list);
  }
  return [...byEmail.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([email, legacyIds]) => ({ email, legacyIds }));
}

/** Same email, different customer UUID in export — never auto-merge. */
function detectCrossEmailMismatches(allRows: StagedRow[], customerRows: StagedRow[]): ReviewItem[] {
  const emailToCustomerIds = new Map<string, Set<string>>();
  for (const row of customerRows) {
    const email = normalizeEmail(row.payload.email);
    if (!email) continue;
    const set = emailToCustomerIds.get(email) ?? new Set<string>();
    set.add(row.legacyId);
    emailToCustomerIds.set(email, set);
  }

  const items: ReviewItem[] = [];
  const leadRows = allRows.filter((r) => r.sourceFile === "leads.csv");
  for (const row of leadRows) {
    const email = normalizeEmail(row.payload.email);
    const cid = (row.payload.customer_id ?? "").trim();
    if (!email || !cid) continue;
    const customerIdsForEmail = emailToCustomerIds.get(email);
    if (!customerIdsForEmail) continue;
    if (customerIdsForEmail.size > 1) {
      items.push({
        entityType: "lead",
        legacyId: row.legacyId,
        sourceFile: "leads.csv",
        reason: "ambiguous_customer_match",
        detail: `Email ${email} maps to ${customerIdsForEmail.size} customer UUIDs in export — no auto-merge`,
        candidates: [...customerIdsForEmail].map((id) => ({ customerId: id })),
      });
    } else if (!customerIdsForEmail.has(cid)) {
      items.push({
        entityType: "lead",
        legacyId: row.legacyId,
        sourceFile: "leads.csv",
        reason: "ambiguous_customer_match",
        detail: `Lead customer_id ${cid} does not match export customer for email ${email}`,
        candidates: [{ leadCustomerId: cid, emailCustomerIds: [...customerIdsForEmail] }],
      });
    }
  }
  return items;
}
