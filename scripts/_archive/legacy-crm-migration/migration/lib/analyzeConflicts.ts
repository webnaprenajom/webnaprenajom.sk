import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { MigrationSourceDef } from "./sources.js";
import type { ReviewItem, StagedRow } from "./types.js";
import {
  buildCustomerMatchHints,
  buildLegacyIdIndex,
  classifyDuplicateEmailGroups,
  detectNotificationLeadOrphans,
  detectOrphanFkRisks,
  detectSensitivePayloads,
  duplicateEmailReviewItems,
  summarizeReviewItems,
} from "./matching.js";
import { normalizeEmail } from "./normalizeIdentity.js";
import { MIGRATION_SOURCES } from "./sources.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BATCH_SIZE = 80;

export type AnalysisInput = {
  stagedRows: StagedRow[];
  sourceDefs: MigrationSourceDef[];
  supabase?: SupabaseClient | null;
};

export type AnalysisResult = {
  uuidCollisions: ReviewItem[];
  duplicateEmailGroups: ReturnType<typeof classifyDuplicateEmailGroups>;
  customerMatchHints: ReviewItem[];
  customerEmailCollisions: ReviewItem[];
  orphanFkRisks: ReviewItem[];
  sensitivePayloads: ReviewItem[];
  allReviewItems: ReviewItem[];
  reviewSummary: Record<string, number>;
};

export async function analyzeConflicts(input: AnalysisInput): Promise<AnalysisResult> {
  const { stagedRows, supabase } = input;
  const bySource = groupBySourceFile(stagedRows);
  const legacyIndex = buildLegacyIdIndex(stagedRows);

  const leadRows = stagedRows.filter((r) => r.entityType === "lead");
  const customerRows = stagedRows.filter((r) => r.entityType === "customer");
  const duplicateEmailGroups = classifyDuplicateEmailGroups(leadRows);

  const uuidCollisions = supabase
    ? await detectUuidCollisionsBatched(stagedRows, supabase)
    : [];

  const orphanFkRisks: ReviewItem[] = [];
  const sensitivePayloads: ReviewItem[] = [];

  for (const def of MIGRATION_SOURCES) {
    const rows = bySource.get(def.sourceFile) ?? [];
    orphanFkRisks.push(...detectOrphanFkRisks(rows, def, legacyIndex));
    sensitivePayloads.push(...detectSensitivePayloads(rows, def));
  }

  const notificationRows = bySource.get("notifications.csv") ?? [];
  const leadIds = legacyIndex.get("leads.csv") ?? new Set<string>();
  orphanFkRisks.push(...detectNotificationLeadOrphans(notificationRows, leadIds));

  let customerMatchHints: ReviewItem[] = [];
  let customerEmailCollisions: ReviewItem[] = [];
  if (supabase) {
    const { data: customers } = await supabase
      .from("customers")
      .select("id,email,display_name,metadata");
    customerMatchHints = buildCustomerMatchHints(leadRows, customers ?? []);
    customerEmailCollisions = await detectCustomerEmailCollisions(customerRows, customers ?? []);
  }

  const allReviewItems = [
    ...uuidCollisions,
    ...duplicateEmailReviewItems(duplicateEmailGroups),
    ...customerEmailCollisions,
    ...customerMatchHints.filter((i) =>
      ["ambiguous_customer_match", "missing_email"].includes(i.reason),
    ),
    ...orphanFkRisks,
    ...sensitivePayloads,
  ];

  return {
    uuidCollisions,
    duplicateEmailGroups,
    customerMatchHints,
    customerEmailCollisions,
    orphanFkRisks,
    sensitivePayloads,
    allReviewItems,
    reviewSummary: summarizeReviewItems(allReviewItems),
  };
}

function groupBySourceFile(rows: StagedRow[]): Map<string, StagedRow[]> {
  const map = new Map<string, StagedRow[]>();
  for (const row of rows) {
    const list = map.get(row.sourceFile) ?? [];
    list.push(row);
    map.set(row.sourceFile, list);
  }
  return map;
}

async function detectUuidCollisionsBatched(
  rows: StagedRow[],
  supabase: SupabaseClient,
): Promise<ReviewItem[]> {
  const items: ReviewItem[] = [];
  const byTable = new Map<string, StagedRow[]>();

  for (const row of rows) {
    if (!UUID_RE.test(row.legacyId)) continue;
    const def = MIGRATION_SOURCES.find((s) => s.sourceFile === row.sourceFile);
    if (!def?.canonicalTable) continue;
    const list = byTable.get(def.canonicalTable) ?? [];
    list.push(row);
    byTable.set(def.canonicalTable, list);
  }

  for (const [canonicalTable, tableRows] of byTable) {
    const uniqueIds = [...new Set(tableRows.map((r) => r.legacyId))];
    for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
      const chunk = uniqueIds.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase
        .from(canonicalTable)
        .select("id")
        .in("id", chunk);

      if (error) {
        for (const id of chunk) {
          const row = tableRows.find((r) => r.legacyId === id);
          if (!row) continue;
          items.push({
            entityType: row.entityType,
            legacyId: id,
            sourceFile: row.sourceFile,
            reason: "uuid_collision",
            detail: `Could not check ${canonicalTable}: ${error.message}`,
          });
        }
        continue;
      }

      const existing = new Set((data ?? []).map((r: { id: string }) => r.id));
      for (const id of chunk) {
        if (!existing.has(id)) continue;
        const row = tableRows.find((r) => r.legacyId === id);
        if (!row) continue;
        items.push({
          entityType: row.entityType,
          legacyId: id,
          sourceFile: row.sourceFile,
          reason: "uuid_collision",
          detail: `Legacy UUID already exists in team ${canonicalTable} — skip + review queue`,
          candidates: [{ canonicalTable, id, action: "skip" }],
        });
      }
    }
  }

  return items;
}

async function detectCustomerEmailCollisions(
  exportCustomers: StagedRow[],
  existingCustomers: Array<{ id: string; email: string | null; display_name: string }>,
): Promise<ReviewItem[]> {
  const byEmail = new Map<string, { id: string; display_name: string }[]>();
  for (const c of existingCustomers) {
    const email = normalizeEmail(c.email);
    if (!email) continue;
    const list = byEmail.get(email) ?? [];
    list.push({ id: c.id, display_name: c.display_name });
    byEmail.set(email, list);
  }

  const items: ReviewItem[] = [];
  for (const row of exportCustomers) {
    const email = normalizeEmail(row.payload.email);
    if (!email) continue;
    const hits = byEmail.get(email) ?? [];
    if (hits.length === 0) continue;
    const sameUuid = hits.some((h) => h.id === row.legacyId);
    if (sameUuid && hits.length === 1) continue;
    if (hits.length === 1 && hits[0].id !== row.legacyId) {
      items.push({
        entityType: "customer",
        legacyId: row.legacyId,
        sourceFile: "customers.csv",
        reason: "uuid_collision",
        detail: `Email ${email} exists on team customer ${hits[0].id} with different UUID — skip, no auto-merge`,
        candidates: [{ teamCustomerId: hits[0].id, legacyCustomerId: row.legacyId, action: "skip" }],
      });
    } else if (hits.length > 1) {
      items.push({
        entityType: "customer",
        legacyId: row.legacyId,
        sourceFile: "customers.csv",
        reason: "ambiguous_customer_match",
        detail: `Email ${email} matches multiple team customers`,
        candidates: hits,
      });
    }
  }
  return items;
}

export function createMigrationSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export const TEAM_PROJECT_REF = "qosxlmrrkyvobjigsynt";
