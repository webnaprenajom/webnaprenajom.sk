import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedCsvRow, StagedRow } from "./types.js";
import { MIGRATION_SOURCES, stagingTableFor } from "./sources.js";
import { computeRowHash } from "./rowHash.js";

export async function resolveBatchId(
  supabase: SupabaseClient,
  batchKey: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("legacy_import_batches")
    .select("id")
    .eq("batch_key", batchKey)
    .maybeSingle();
  if (error) throw new Error(`Batch lookup failed: ${error.message}`);
  return data?.id ?? null;
}

export async function loadStagingRows(
  supabase: SupabaseClient,
  batchKey: string,
): Promise<{ batchId: string; rows: StagedRow[] }> {
  const batchId = await resolveBatchId(supabase, batchKey);
  if (!batchId) {
    throw new Error(`Batch not found: ${batchKey}. Run --write-staging first.`);
  }

  const rows: StagedRow[] = [];

  const { data: entityRows, error: e1 } = await supabase
    .from("legacy_import_rows")
    .select("source_file,legacy_id,row_hash,payload")
    .eq("batch_id", batchId);

  if (e1) throw new Error(`legacy_import_rows: ${e1.message}`);

  for (const r of entityRows ?? []) {
    const def = MIGRATION_SOURCES.find((s) => s.sourceFile === r.source_file);
    rows.push({
      sourceFile: r.source_file,
      entityType: def?.entityType ?? "unknown",
      legacyId: r.legacy_id,
      rowHash: r.row_hash,
      payload: r.payload as ParsedCsvRow,
    });
  }

  const { data: financeRows, error: e2 } = await supabase
    .from("legacy_finance_staging")
    .select("source_file,legacy_id,row_hash,payload")
    .eq("batch_id", batchId);

  if (e2) throw new Error(`legacy_finance_staging: ${e2.message}`);

  for (const r of financeRows ?? []) {
    const def = MIGRATION_SOURCES.find((s) => s.sourceFile === r.source_file);
    rows.push({
      sourceFile: r.source_file,
      entityType: def?.entityType ?? "unknown",
      legacyId: r.legacy_id,
      rowHash: r.row_hash,
      payload: r.payload as ParsedCsvRow,
    });
  }

  return { batchId, rows };
}

export function stagedRowsFromCsv(
  rows: Array<{ sourceFile: string; entityType: string; legacyId: string; payload: ParsedCsvRow }>,
): StagedRow[] {
  return rows.map((r) => ({
    ...r,
    rowHash: computeRowHash(r.payload),
  }));
}

export function stagingTableForSource(sourceFile: string): string {
  const def = MIGRATION_SOURCES.find((s) => s.sourceFile === sourceFile);
  return def ? stagingTableFor(def) : "legacy_import_rows";
}
