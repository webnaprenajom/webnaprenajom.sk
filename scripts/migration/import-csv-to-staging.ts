#!/usr/bin/env node
/**
 * Phase 1 — Legacy CRM CSV → staging tables + conflict analysis.
 * Does NOT promote into canonical business tables.
 */

import { existsSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { analyzeConflicts, createMigrationSupabase } from "./lib/analyzeConflicts.js";
import { readCsvFile } from "./lib/csvParser.js";
import { computeRowHash } from "./lib/rowHash.js";
import { writeMigrationReports } from "./lib/report.js";
import { MIGRATION_SOURCES, resolveSourceFile } from "./lib/sources.js";
import type { ImportStats, MigrationReport, StagedRow } from "./lib/types.js";

type CliArgs = {
  dryRun: boolean;
  batch: string;
  dir: string;
  skipDbAnalysis: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  let dryRun = false;
  let batch = "";
  let dir = "";
  let skipDbAnalysis = false;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--skip-db-analysis") skipDbAnalysis = true;
    else if (arg === "--batch" && argv[i + 1]) batch = argv[++i];
    else if (arg === "--dir" && argv[i + 1]) dir = argv[++i];
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  if (!batch || !dir) {
    console.error("Missing required --batch and --dir");
    printHelp();
    process.exit(1);
  }

  return { dryRun, batch, dir: resolve(dir), skipDbAnalysis };
}

function printHelp() {
  console.log(`
Legacy CRM Phase 1 — import CSV to staging

Usage:
  npx tsx scripts/migration/import-csv-to-staging.ts --batch <key> --dir <csv-folder> [--dry-run]

Options:
  --batch   Batch key (e.g. legacy_crm_2026_06)
  --dir     Directory containing legacy CSV exports
  --dry-run Parse + analyze only; no DB writes
  --skip-db-analysis  Skip canonical UUID collision checks (offline mode)
`);
}

type LoadedFile = {
  sourceFile: string;
  entityType: string;
  kind: "entity" | "finance" | "activity";
  diskPath: string;
  rows: StagedRow[];
};

function discoverAndParse(dir: string): { loaded: LoadedFile[]; missing: string[]; unknown: string[] } {
  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".csv"));
  const loaded: LoadedFile[] = [];
  const missing: string[] = [];
  const unknown: string[] = [];
  const matchedCanonical = new Set<string>();

  for (const file of files) {
    const resolved = resolveSourceFile(file);
    if (!resolved) {
      unknown.push(file);
      continue;
    }
    matchedCanonical.add(resolved.def.sourceFile);
    const diskPath = join(dir, file);
    const parsed = readCsvFile(diskPath);
    const rows: StagedRow[] = [];

    for (const payload of parsed) {
      const legacyId = (payload[resolved.def.legacyIdField] ?? "").trim();
      if (!legacyId) continue;
      rows.push({
        sourceFile: resolved.def.sourceFile,
        entityType: resolved.def.entityType,
        legacyId,
        rowHash: computeRowHash(payload),
        payload,
      });
    }

    loaded.push({
      sourceFile: resolved.def.sourceFile,
      entityType: resolved.def.entityType,
      kind: resolved.def.kind,
      diskPath,
      rows,
    });
  }

  for (const def of MIGRATION_SOURCES) {
    if (!matchedCanonical.has(def.sourceFile)) {
      missing.push(def.sourceFile);
    }
  }

  return { loaded, missing, unknown };
}

async function ensureBatch(
  supabase: SupabaseClient,
  batchKey: string,
  dryRun: boolean,
): Promise<string> {
  const status = dryRun ? "dry_run" : "running";
  const { data: existing } = await supabase
    .from("legacy_import_batches")
    .select("id")
    .eq("batch_key", batchKey)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from("legacy_import_batches")
    .insert({ batch_key: batchKey, status, source_env: "legacy_csv" })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create batch: ${error.message}`);
  return data.id;
}

async function upsertStagingRows(
  supabase: SupabaseClient,
  batchId: string,
  file: LoadedFile,
): Promise<ImportStats> {
  const stats: ImportStats = {
    sourceFile: file.sourceFile,
    entityType: file.entityType,
    rowsParsed: file.rows.length,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    errors: [],
  };

  const table = file.kind === "finance" ? "legacy_finance_staging" : "legacy_import_rows";

  for (const row of file.rows) {
    const { data: existing, error: readErr } = await supabase
      .from(table)
      .select("id,row_hash")
      .eq("source_file", row.sourceFile)
      .eq("legacy_id", row.legacyId)
      .maybeSingle();

    if (readErr) {
      stats.errors.push(`${row.legacyId}: ${readErr.message}`);
      stats.skipped++;
      continue;
    }

    if (!existing) {
      const insertPayload =
        table === "legacy_finance_staging"
          ? {
              batch_id: batchId,
              source_file: row.sourceFile,
              legacy_id: row.legacyId,
              row_hash: row.rowHash,
              payload: row.payload,
            }
          : {
              batch_id: batchId,
              source_file: row.sourceFile,
              legacy_id: row.legacyId,
              row_hash: row.rowHash,
              payload: row.payload,
            };

      const { error } = await supabase.from(table).insert(insertPayload);
      if (error) {
        stats.errors.push(`${row.legacyId}: ${error.message}`);
        stats.skipped++;
      } else {
        stats.inserted++;
      }
      continue;
    }

    if (existing.row_hash === row.rowHash) {
      stats.unchanged++;
      continue;
    }

    const { error } = await supabase
      .from(table)
      .update({
        batch_id: batchId,
        row_hash: row.rowHash,
        payload: row.payload,
      })
      .eq("id", existing.id);

    if (error) {
      stats.errors.push(`${row.legacyId}: ${error.message}`);
      stats.skipped++;
    } else {
      stats.updated++;
    }
  }

  return stats;
}

async function persistReviewQueue(
  supabase: SupabaseClient,
  batchId: string,
  items: MigrationReport["analysis"]["uuidCollisions"],
  extra: MigrationReport["analysis"],
) {
  const all = [
    ...items,
    ...extra.orphanFkRisks,
    ...extra.customerMatchHints.filter((i) =>
      ["ambiguous_customer_match", "missing_email"].includes(i.reason),
    ),
    ...extra.sensitivePayloads,
  ];

  if (all.length === 0) return;

  await supabase.from("migration_review_queue").delete().eq("batch_id", batchId);

  const rows = all.map((item) => ({
    batch_id: batchId,
    source_file: item.sourceFile,
    entity_type: item.entityType,
    legacy_id: item.legacyId,
    reason: item.reason,
    detail: item.detail,
    candidates: item.candidates ?? [],
    status: "pending",
  }));

  const { error } = await supabase.from("migration_review_queue").insert(rows);
  if (error) console.warn("Review queue insert warning:", error.message);
}

async function main() {
  const args = parseArgs(process.argv);
  if (!existsSync(args.dir)) {
    console.error(`Directory not found: ${args.dir}`);
    process.exit(1);
  }

  const startedAt = new Date().toISOString();
  console.log(`\nLegacy CRM Phase 1 — batch=${args.batch} dryRun=${args.dryRun}`);
  console.log(`CSV dir: ${args.dir}\n`);

  const { loaded, missing, unknown } = discoverAndParse(args.dir);
  const allStaged = loaded.flatMap((f) => f.rows);

  if (unknown.length) {
    console.warn("Unrecognized CSV files (skipped):", unknown.join(", "));
  }
  if (missing.length) {
    console.warn("Expected sources not found in dir:", missing.join(", "));
  }

  const importStats: ImportStats[] = loaded.map((f) => ({
    sourceFile: f.sourceFile,
    entityType: f.entityType,
    rowsParsed: f.rows.length,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    errors: [],
  }));

  const supabase = args.dryRun ? null : createMigrationSupabase();
  if (!args.dryRun && !supabase) {
    console.error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for non-dry-run import.",
    );
    process.exit(1);
  }

  let batchId: string | null = null;

  if (!args.dryRun && supabase) {
    batchId = await ensureBatch(supabase, args.batch, false);
    console.log(`Batch id: ${batchId}`);

    for (let i = 0; i < loaded.length; i++) {
      const file = loaded[i];
      console.log(`Staging ${file.sourceFile} (${file.rows.length} rows)...`);
      importStats[i] = await upsertStagingRows(supabase, batchId, file);
      console.log(
        `  → inserted=${importStats[i].inserted} updated=${importStats[i].updated} unchanged=${importStats[i].unchanged}`,
      );
    }
  } else {
    console.log("Dry-run: skipping DB staging writes.");
    for (const s of importStats) {
      s.inserted = 0;
      s.updated = 0;
      s.unchanged = s.rowsParsed;
    }
  }

  const analysisSupabase =
    args.skipDbAnalysis && args.dryRun ? null : createMigrationSupabase();

  console.log("\nRunning conflict analysis...");
  const analysis = await analyzeConflicts({
    stagedRows: allStaged,
    sourceDefs: MIGRATION_SOURCES,
    supabase: analysisSupabase,
  });

  const financeRowsStaged = loaded
    .filter((f) => f.kind === "finance")
    .reduce((n, f) => n + f.rows.length, 0);
  const entityRowsStaged = allStaged.length - financeRowsStaged;

  const finishedAt = new Date().toISOString();
  const report: MigrationReport = {
    batchKey: args.batch,
    dryRun: args.dryRun,
    dir: args.dir,
    startedAt,
    finishedAt,
    importStats,
    analysis: {
      uuidCollisions: analysis.uuidCollisions,
      duplicateEmailGroups: analysis.duplicateEmailGroups,
      customerMatchHints: analysis.customerMatchHints,
      orphanFkRisks: analysis.orphanFkRisks,
      sensitivePayloads: analysis.sensitivePayloads,
      reviewSummary: analysis.reviewSummary,
    },
    totals: {
      rowsParsed: allStaged.length,
      rowsStaged: entityRowsStaged,
      financeRowsStaged,
      reviewItems: analysis.allReviewItems.length,
    },
  };

  const outDir = join(process.cwd(), "scripts", "migration", "reports");
  const paths = writeMigrationReports(report, outDir);
  console.log("\nReports written:");
  console.log(" ", paths.jsonPath);
  console.log(" ", paths.mdPath);
  console.log(" ", paths.reviewCsvPath);

  if (!args.dryRun && supabase && batchId) {
    await persistReviewQueue(supabase, batchId, analysis.uuidCollisions, report.analysis);
    await supabase
      .from("legacy_import_batches")
      .update({ status: "completed", finished_at: finishedAt, report_json: report })
      .eq("id", batchId);
  }

  console.log("\nSummary:");
  console.log(`  Rows parsed: ${report.totals.rowsParsed}`);
  console.log(`  Entity/activity staged: ${report.totals.rowsStaged}`);
  console.log(`  Finance staged: ${report.totals.financeRowsStaged}`);
  console.log(`  Review items: ${report.totals.reviewItems}`);
  console.log(`  Duplicate email groups: ${analysis.duplicateEmailGroups.length}`);
  console.log(`  UUID collisions: ${analysis.uuidCollisions.length}`);
  console.log(`  Orphan FK risks: ${analysis.orphanFkRisks.length}`);
  console.log(`  Sensitive payloads: ${analysis.sensitivePayloads.length}`);

  for (const f of loaded) {
    console.log(`  ${basename(f.diskPath)} → ${f.sourceFile}: ${f.rows.length} rows`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
