#!/usr/bin/env node
/**
 * Phase 5 — promote dry-run or execute (guarded).
 * Default: --dry-run. Execute requires MIGRATION_ALLOW_PROMOTE=true + MIGRATION_APPROVED_BATCH.
 */

import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { analyzeConflicts, createMigrationSupabase, TEAM_PROJECT_REF } from "./lib/analyzeConflicts.js";
import { readCsvFile } from "./lib/csvParser.js";
import { loadMigrationEnv } from "./lib/loadEnv.js";
import { loadStagingRows } from "./lib/loadStaging.js";
import { enrichPlanWithLiveCollisions, printPromoteSummary } from "./lib/printPromoteSummary.js";
import { computeRowHash } from "./lib/rowHash.js";
import { buildPromotePlan } from "./lib/promotePlan.js";
import {
  buildUserRolesMappingTemplate,
  writePromoteReports,
} from "./lib/promoteReport.js";
import type { SqlPromoteStep } from "./lib/promoteTableRegistry.js";
import { SQL_WIRED_STEPS } from "./lib/promoteTableRegistry.js";
import { MIGRATION_SOURCES, resolveSourceFile } from "./lib/sources.js";
import type { StagedRow } from "./lib/types.js";

loadMigrationEnv();

type Args = {
  batch: string;
  dryRun: boolean;
  fromStaging: boolean;
  dir: string;
  steps: SqlPromoteStep[] | null;
};

function parseArgs(argv: string[]): Args {
  let batch = "legacy_crm_2026_06_20";
  let dryRun = true;
  let fromStaging = true;
  let dir = resolve(process.cwd(), "crm-export");
  let steps: SqlPromoteStep[] | null = null;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--execute") dryRun = false;
    else if (arg === "--from-csv") fromStaging = false;
    else if (arg === "--from-staging") fromStaging = true;
    else if (arg.startsWith("--batch=")) batch = arg.split("=")[1] ?? batch;
    else if (arg === "--batch" && argv[i + 1]) batch = argv[++i];
    else if (arg.startsWith("--batch-id=")) batch = arg.split("=")[1] ?? batch;
    else if (arg === "--dir" && argv[i + 1]) dir = resolve(argv[++i]);
    else if (arg.startsWith("--steps=")) {
      steps = parseSteps(arg.split("=")[1] ?? "");
    } else if (arg === "--steps" && argv[i + 1]) {
      steps = parseSteps(argv[++i]);
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return { batch, dryRun, fromStaging, dir, steps };
}

function parseSteps(raw: string): SqlPromoteStep[] {
  const parts = raw.split(",").map((s) => s.trim());
  for (const p of parts) {
    if (!SQL_WIRED_STEPS.includes(p as SqlPromoteStep)) {
      console.error(`Invalid step "${p}". Allowed: ${SQL_WIRED_STEPS.join(", ")}`);
      process.exit(1);
    }
  }
  return parts as SqlPromoteStep[];
}

function printHelp() {
  console.log(`
Legacy CRM Phase 5 — promote (dry-run default)

Usage:
  npm run migrate:legacy:promote -- --batch legacy_crm_2026_06_20 --dry-run
  npm run migrate:legacy:promote -- --batch legacy_crm_2026_06_20 --steps customers,leads
  npm run migrate:legacy:promote -- --batch legacy_crm_2026_06_20 --execute

Options:
  --batch, --batch-id   Batch key (default: legacy_crm_2026_06_20)
  --dry-run             Preview only (default)
  --execute             SQL RPC promote (guarded — see README)
  --steps a,b,c         Partial SQL promote: ${SQL_WIRED_STEPS.join(", ")}
  --from-staging        Load from legacy_import_* (default)
  --from-csv            Load from --dir CSV

Execute guards (both required):
  MIGRATION_ALLOW_PROMOTE=true
  MIGRATION_APPROVED_BATCH=<same as --batch>

See scripts/migration/promote/README.md for full operator sequence.
`);
}

function loadFromCsv(dir: string): StagedRow[] {
  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".csv"));
  const rows: StagedRow[] = [];
  for (const file of files) {
    const resolved = resolveSourceFile(file);
    if (!resolved) continue;
    for (const payload of readCsvFile(join(dir, file))) {
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
  }
  return rows;
}

function assertExecuteAllowed(batch: string): void {
  if (process.env.MIGRATION_ALLOW_PROMOTE !== "true") {
    console.error("\nEXECUTE blocked: set MIGRATION_ALLOW_PROMOTE=true");
    process.exit(1);
  }
  if (process.env.MIGRATION_APPROVED_BATCH !== batch) {
    console.error(
      `\nEXECUTE blocked: set MIGRATION_APPROVED_BATCH=${batch}`,
    );
    console.error(
      '  (must match your explicit approval message for this batch)',
    );
    process.exit(1);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const supabase = createMigrationSupabase();
  if (!supabase) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.");
    process.exit(1);
  }

  console.log(`\nLegacy CRM promote — batch=${args.batch}`);
  console.log(`  target: ${TEAM_PROJECT_REF}`);
  console.log(`  mode:   ${args.dryRun ? "DRY-RUN" : "EXECUTE"}`);
  console.log(`  source: ${args.fromStaging ? "staging tables" : args.dir}`);
  if (args.steps) console.log(`  steps:  ${args.steps.join(", ")} (SQL RPC partial)`);
  console.log("");

  let stagedRows: StagedRow[];
  if (args.fromStaging) {
    const loaded = await loadStagingRows(supabase, args.batch);
    stagedRows = loaded.rows;
    console.log(`Loaded ${stagedRows.length} staged rows (batch id ${loaded.batchId})`);
  } else {
    if (!existsSync(args.dir)) {
      console.error(`Directory not found: ${args.dir}`);
      process.exit(1);
    }
    stagedRows = loadFromCsv(args.dir);
    console.log(`Loaded ${stagedRows.length} rows from CSV`);
  }

  const analysis = await analyzeConflicts({ stagedRows, sourceDefs: MIGRATION_SOURCES, supabase });
  const basePlan = await buildPromotePlan({
    batchKey: args.batch,
    dryRun: args.dryRun,
    stagedRows,
    supabase,
  });
  const plan = enrichPlanWithLiveCollisions(basePlan, analysis);

  const userRoleRows = stagedRows.filter((r) => r.sourceFile === "user_roles.csv");
  const mapping = buildUserRolesMappingTemplate(args.batch, userRoleRows);

  const outDir = join(process.cwd(), "scripts", "migration", "reports");
  const paths = writePromoteReports(plan, outDir, mapping);

  printPromoteSummary(plan);

  console.log("\nReport files:");
  console.log(" ", paths.jsonPath);
  console.log(" ", paths.mdPath);
  console.log(" ", paths.skipCsvPath);
  if (paths.mappingPath) console.log(" ", paths.mappingPath);

  if (args.dryRun && args.fromStaging) {
    const { data: rpcPreview, error: rpcErr } = await supabase.rpc("legacy_promote_batch", {
      p_batch_key: args.batch,
      p_dry_run: true,
      p_steps: args.steps,
    });
    if (rpcErr) {
      console.warn("\nSQL RPC dry-run unavailable:", rpcErr.message);
      console.warn("(Apply migrations 20260620180000 + 20260620190000 via db push)");
    } else {
      console.log("\nSQL RPC dry-run result:");
      console.log(JSON.stringify(rpcPreview, null, 2));
    }
    console.log("\nDry-run complete — no production writes.");
    return;
  }

  if (args.dryRun) {
    console.log("\nDry-run complete — no production writes.");
    return;
  }

  assertExecuteAllowed(args.batch);

  console.log("\nCalling legacy_promote_batch RPC (production write)...");
  const { data, error } = await supabase.rpc("legacy_promote_batch", {
    p_batch_key: args.batch,
    p_dry_run: false,
    p_steps: args.steps,
  });

  if (error) {
    console.error("Promote RPC failed:", error.message);
    process.exit(1);
  }

  console.log("Promote result:", JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
