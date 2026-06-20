import type { AnalysisResult } from "./analyzeConflicts.js";
import type { PromotePlanSummary } from "./promotePolicies.js";
import { PROMOTE_TABLE_REGISTRY, SQL_WIRED_STEPS } from "./promoteTableRegistry.js";

export function enrichPlanWithLiveCollisions(
  plan: PromotePlanSummary,
  analysis: AnalysisResult,
): PromotePlanSummary {
  const skipReasonsBySource: PromotePlanSummary["skipReasonsBySource"] = {};

  for (const row of plan.rows) {
    if (row.outcome === "would_insert") continue;
    const bucket = skipReasonsBySource[row.sourceFile] ?? {};
    bucket[row.outcome] = (bucket[row.outcome] ?? 0) + 1;
    skipReasonsBySource[row.sourceFile] = bucket;
  }

  return {
    ...plan,
    skipReasonsBySource,
    liveCollisions: {
      uuid: analysis.uuidCollisions.length,
      customerEmail: analysis.customerEmailCollisions.length,
      uuidSamples: analysis.uuidCollisions.slice(0, 5).map((i) => ({
        sourceFile: i.sourceFile,
        legacyId: i.legacyId,
        detail: i.detail,
      })),
      emailSamples: analysis.customerEmailCollisions.slice(0, 5).map((i) => ({
        sourceFile: i.sourceFile,
        legacyId: i.legacyId,
        detail: i.detail,
      })),
    },
    tableRegistry: PROMOTE_TABLE_REGISTRY,
  };
}

export function printPromoteSummary(plan: PromotePlanSummary): void {
  const line = "─".repeat(72);

  console.log(`\n${line}`);
  console.log("PROMOTE DRY-RUN SUMMARY");
  console.log(line);
  console.log(`Batch:   ${plan.batchKey}`);
  console.log(`Target:  team Supabase ${plan.targetProjectRef}`);
  console.log(`Mode:    ${plan.dryRun ? "DRY-RUN (no production writes)" : "EXECUTE"}`);

  console.log(`\n${line}`);
  console.log("GLOBAL OUTCOMES");
  console.log(line);
  for (const [outcome, count] of Object.entries(plan.byOutcome)) {
    if (count > 0) console.log(`  ${pad(outcome, 28)} ${count}`);
  }

  if (plan.liveCollisions) {
    console.log(`\n${line}`);
    console.log("LIVE TEAM DB COLLISIONS");
    console.log(line);
    console.log(`  UUID collisions:          ${plan.liveCollisions.uuid}`);
    console.log(`  Customer email collisions: ${plan.liveCollisions.customerEmail}`);
    for (const s of plan.liveCollisions.uuidSamples) {
      console.log(`    • [uuid] ${s.sourceFile} ${s.legacyId} — ${s.detail}`);
    }
    for (const s of plan.liveCollisions.emailSamples) {
      console.log(`    • [email] ${s.sourceFile} ${s.legacyId} — ${s.detail}`);
    }
    if (plan.liveCollisions.uuid === 0 && plan.liveCollisions.customerEmail === 0) {
      console.log("  (none detected against live team DB)");
    }
  }

  console.log(`\n${line}`);
  console.log("PER-TABLE (CLI plan — all 18 promote-ordered sources)");
  console.log(line);
  console.log(
    pad("Source", 36) +
      pad("Would", 8) +
      pad("Skip", 8) +
      pad("Review", 8) +
      "SQL RPC",
  );
  console.log(line);

  for (const entry of PROMOTE_TABLE_REGISTRY) {
    const stats = plan.bySource.find((s) => s.sourceFile === entry.sourceFile);
    const would = stats?.wouldInsert ?? 0;
    const skip = stats?.skipped ?? 0;
    const review = stats?.reviewQueue ?? 0;
    const sqlCol =
      entry.status === "sql_wired"
        ? `yes (${entry.sqlStep})`
        : entry.status === "manual_only"
          ? "manual"
          : entry.status === "skip_policy"
            ? "n/a"
            : "TODO";

    if (would + skip + review === 0 && entry.status === "skip_policy") continue;

    console.log(
      pad(entry.sourceFile, 36) +
        pad(String(would), 8) +
        pad(String(skip), 8) +
        pad(String(review), 8) +
        sqlCol,
    );

    const reasons = plan.skipReasonsBySource?.[entry.sourceFile];
    if (reasons && skip > 0) {
      const top = Object.entries(reasons)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k, n]) => `${k}=${n}`)
        .join(", ");
      console.log(`${"".padEnd(36)}↳ skip reasons: ${top}`);
    }
  }

  console.log(`\n${line}`);
  console.log("SQL RPC legacy_promote_batch — 18 wired steps");
  console.log(line);
  console.log(`  Wired:   ${SQL_WIRED_STEPS.join(", ")}`);
  console.log(`  Manual:  user_roles (see user-roles-mapping-*.yaml)`);
  console.log(`  Skipped: team_profiles, order_signatures, commission_rule_overrides, customer_communication_summaries`);
  console.log(`\n  Full --execute requires MIGRATION_ALLOW_PROMOTE + MIGRATION_APPROVED_BATCH + explicit approval.`);

  console.log(`\n${line}`);
  console.log("NEXT: review promote-skipped-*.csv and promote-plan-*.md in reports/");
  console.log(line);
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n - 1) + " " : s + " ".repeat(n - s.length);
}
