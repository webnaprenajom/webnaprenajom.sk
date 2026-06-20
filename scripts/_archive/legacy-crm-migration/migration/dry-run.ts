#!/usr/bin/env node
/**
 * Phase 2/3 — dry-run only: parse CSV, analyze conflicts, write reports.
 * Does NOT write staging or production tables unless --write-staging is passed.
 */

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { loadMigrationEnv } from "./lib/loadEnv.js";

loadMigrationEnv();

const args = process.argv.slice(2);
const hasBatch = args.includes("--batch");
const hasDir = args.includes("--dir");

const batch =
  hasBatch && args[args.indexOf("--batch") + 1]
    ? args[args.indexOf("--batch") + 1]
    : "legacy_crm_2026_06_20";

const dir =
  hasDir && args[args.indexOf("--dir") + 1]
    ? resolve(args[args.indexOf("--dir") + 1])
    : resolve(process.cwd(), "crm-export");

const writeStaging = args.includes("--write-staging");
const skipDb = args.includes("--skip-db-analysis");

const forward = [
  resolve(process.cwd(), "scripts/migration/import-csv-to-staging.ts"),
  "--batch",
  batch,
  "--dir",
  dir,
  ...(writeStaging ? [] : ["--dry-run"]),
  ...(skipDb ? ["--skip-db-analysis"] : []),
];

console.log("Legacy CRM dry-run");
console.log(`  batch: ${batch}`);
console.log(`  dir:   ${dir}`);
console.log(`  mode:  ${writeStaging ? "staging write + analysis" : "dry-run (no DB writes)"}`);
console.log(`  db:    ${skipDb ? "offline analysis only" : "team introspection if SUPABASE_* set"}\n`);

const result = spawnSync("npx", ["tsx", ...forward], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);
