import { createMigrationSupabase } from "./lib/analyzeConflicts.js";
import { loadMigrationEnv } from "./lib/loadEnv.js";

loadMigrationEnv();

async function fetchAll<T>(
  sb: ReturnType<typeof createMigrationSupabase>,
  table: string,
  select: string,
  filter?: { col: string; val: string },
): Promise<T[]> {
  const pageSize = 1000;
  const out: T[] = [];
  let from = 0;
  while (true) {
    let q = sb!.from(table).select(select).range(from, from + pageSize - 1);
    if (filter) q = q.eq(filter.col, filter.val);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    out.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

async function main() {
  const sb = createMigrationSupabase();
  if (!sb) throw new Error("no supabase client");

  const tables = [
    "customers",
    "commission_rules",
    "leads",
    "rental_websites",
    "hosting_records",
    "rental_payments",
    "commissions",
    "payment_records",
    "cost_records",
    "payout_records",
    "expenses",
    "project_notes",
    "tasks",
    "lead_logs",
    "notifications",
    "wheel_spins",
    "design_proposals",
    "communication_events",
    "user_roles",
  ];

  console.log("=== TABLE COUNTS ===");
  for (const t of tables) {
    const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
    console.log(`${t}: ${error ? error.message : count}`);
  }

  const { data: batch } = await sb
    .from("legacy_import_batches")
    .select("id, report_json")
    .eq("batch_key", "legacy_crm_2026_06_20")
    .single();

  const maps = await fetchAll<{ entity_type: string; match_method: string }>(
    sb,
    "legacy_id_map",
    "entity_type, match_method",
    { col: "batch_id", val: batch!.id },
  );

  const mapTally: Record<string, number> = {};
  for (const r of maps) {
    const k = `${r.entity_type}:${r.match_method}`;
    mapTally[k] = (mapTally[k] ?? 0) + 1;
  }
  console.log("\n=== legacy_id_map (this batch) ===");
  console.log(JSON.stringify(mapTally, null, 2));
  console.log(`total map rows: ${maps.length}`);

  const reviews = await fetchAll<{ reason: string; entity_type: string }>(
    sb,
    "migration_review_queue",
    "reason, entity_type",
    { col: "batch_id", val: batch!.id },
  );
  const reviewTally: Record<string, number> = {};
  for (const r of reviews) {
    const k = `${r.entity_type}:${r.reason}`;
    reviewTally[k] = (reviewTally[k] ?? 0) + 1;
  }
  console.log("\n=== migration_review_queue (this batch) ===");
  const top = Object.entries(reviewTally).sort((a, b) => b[1] - a[1]).slice(0, 20);
  for (const [k, n] of top) console.log(`  ${k}: ${n}`);
  console.log(`total review rows: ${reviews.length}`);

  const { data: prTruth } = await sb
    .from("payment_records")
    .select("truth_level, imported_from")
    .limit(5);
  console.log("\n=== payment_records sample (FACT as-is) ===");
  console.log(JSON.stringify(prTruth, null, 2));

  if (batch?.report_json?.promote) {
    console.log("\n=== batch report_json.promote ===");
    console.log(JSON.stringify(batch.report_json.promote, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
