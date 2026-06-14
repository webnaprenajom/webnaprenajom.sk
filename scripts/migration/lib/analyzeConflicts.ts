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
import { MIGRATION_SOURCES } from "./sources.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AnalysisInput = {
  stagedRows: StagedRow[];
  sourceDefs: MigrationSourceDef[];
  supabase?: SupabaseClient | null;
};

export type AnalysisResult = {
  uuidCollisions: ReviewItem[];
  duplicateEmailGroups: ReturnType<typeof classifyDuplicateEmailGroups>;
  customerMatchHints: ReviewItem[];
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
  const duplicateEmailGroups = classifyDuplicateEmailGroups(leadRows);

  const uuidCollisions = supabase
    ? await detectUuidCollisions(stagedRows, supabase)
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
  if (supabase) {
    const { data: customers } = await supabase
      .from("customers")
      .select("id,email,display_name,metadata");
    customerMatchHints = buildCustomerMatchHints(leadRows, customers ?? []);
  }

  const allReviewItems = [
    ...uuidCollisions,
    ...duplicateEmailReviewItems(duplicateEmailGroups),
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

async function detectUuidCollisions(
  rows: StagedRow[],
  supabase: SupabaseClient,
): Promise<ReviewItem[]> {
  const items: ReviewItem[] = [];
  const checked = new Set<string>();

  for (const row of rows) {
    if (!UUID_RE.test(row.legacyId)) continue;
    const def = MIGRATION_SOURCES.find((s) => s.sourceFile === row.sourceFile);
    if (!def?.canonicalTable) continue;

    const cacheKey = `${def.canonicalTable}:${row.legacyId}`;
    if (checked.has(cacheKey)) continue;
    checked.add(cacheKey);

    const { data, error } = await supabase
      .from(def.canonicalTable)
      .select("id")
      .eq("id", row.legacyId)
      .maybeSingle();

    if (error) {
      items.push({
        entityType: row.entityType,
        legacyId: row.legacyId,
        sourceFile: row.sourceFile,
        reason: "uuid_collision",
        detail: `Could not check ${def.canonicalTable}: ${error.message}`,
      });
      continue;
    }

    if (data?.id) {
      items.push({
        entityType: row.entityType,
        legacyId: row.legacyId,
        sourceFile: row.sourceFile,
        reason: "uuid_collision",
        detail: `Legacy UUID already exists in canonical ${def.canonicalTable}`,
        candidates: [{ canonicalTable: def.canonicalTable, id: row.legacyId }],
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
