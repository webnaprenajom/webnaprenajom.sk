import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PromotePlanSummary } from "./promotePolicies.js";
import { PROMOTE_TABLE_REGISTRY, SQL_WIRED_STEPS } from "./promoteTableRegistry.js";
import type { StagedRow } from "./types.js";

export type UserRolesMappingFile = {
  batchKey: string;
  instructions: string;
  mappings: Array<{
    legacy_user_role_id: string;
    legacy_user_id: string;
    role: string;
    team_user_id: string | null;
    notes: string;
  }>;
};

export function buildUserRolesMappingTemplate(
  batchKey: string,
  userRoleRows: StagedRow[],
): UserRolesMappingFile {
  return {
    batchKey,
    instructions:
      "Fill team_user_id with the UUID from auth.users on team Supabase (qosxlmrrkyvobjigsynt). Never map to profiles.",
    mappings: userRoleRows.map((r) => ({
      legacy_user_role_id: r.legacyId,
      legacy_user_id: r.payload.user_id ?? "",
      role: r.payload.role ?? "",
      team_user_id: null,
      notes: "Set after creating/inviting user in team Auth dashboard",
    })),
  };
}

export function writePromoteReports(
  plan: PromotePlanSummary,
  outDir: string,
  userRolesMapping?: UserRolesMappingFile,
): { jsonPath: string; mdPath: string; skipCsvPath: string; mappingPath?: string } {
  mkdirSync(outDir, { recursive: true });
  const safe = plan.batchKey.replace(/[^a-zA-Z0-9_-]/g, "_");
  const jsonPath = join(outDir, `promote-plan-${safe}.json`);
  const mdPath = join(outDir, `promote-plan-${safe}.md`);
  const skipCsvPath = join(outDir, `promote-skipped-${safe}.csv`);

  writeFileSync(jsonPath, JSON.stringify(plan, null, 2), "utf8");
  writeFileSync(mdPath, renderMd(plan), "utf8");
  writeFileSync(skipCsvPath, renderSkipCsv(plan), "utf8");

  let mappingPath: string | undefined;
  if (userRolesMapping) {
    mappingPath = join(outDir, `user-roles-mapping-${safe}.json`);
    writeFileSync(mappingPath, JSON.stringify(userRolesMapping, null, 2), "utf8");
    const yamlPath = join(outDir, `user-roles-mapping-${safe}.yaml`);
    writeFileSync(yamlPath, renderYamlMapping(userRolesMapping), "utf8");
    mappingPath = yamlPath;
  }

  return { jsonPath, mdPath, skipCsvPath, mappingPath };
}

function renderMd(plan: PromotePlanSummary): string {
  const lines = [
    `# Promote Plan — ${plan.batchKey}`,
    "",
    `- **Dry run:** ${plan.dryRun}`,
    `- **Target:** \`${plan.targetProjectRef}\``,
    "",
    "## Outcomes",
    "",
    "| Outcome | Count |",
    "|---------|------:|",
  ];
  for (const [k, v] of Object.entries(plan.byOutcome)) {
    if (v > 0) lines.push(`| ${k} | ${v} |`);
  }
  lines.push("", "## By source", "", "| Source | Would insert | Skipped | Review queue |", "|--------|-------------:|--------:|-------------:|");
  for (const s of plan.bySource) {
    lines.push(`| ${s.sourceFile} | ${s.wouldInsert} | ${s.skipped} | ${s.reviewQueue} |`);
  }

  lines.push("", "## SQL RPC wiring status", "");
  lines.push("| Source | Status | SQL step |");
  lines.push("|--------|--------|----------|");
  for (const e of PROMOTE_TABLE_REGISTRY) {
    const sql = e.sqlStep ?? (e.status === "manual_only" ? "manual" : e.status === "skip_policy" ? "—" : "TODO");
    lines.push(`| ${e.sourceFile} | ${e.status} | ${sql} |`);
  }

  if (plan.liveCollisions) {
    lines.push("", "## Live team DB collisions", "");
    lines.push(`- UUID: ${plan.liveCollisions.uuid}`);
    lines.push(`- Customer email: ${plan.liveCollisions.customerEmail}`);
  }

  if (plan.skipReasonsBySource && Object.keys(plan.skipReasonsBySource).length > 0) {
    lines.push("", "## Skip reasons by source (top)", "");
    for (const [source, reasons] of Object.entries(plan.skipReasonsBySource)) {
      const top = Object.entries(reasons)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");
      lines.push(`- **${source}**: ${top}`);
    }
  }

  lines.push("", "## Policies", "");
  lines.push("- Orphan `lead_logs` → **OPTION A skip** (staging + review queue)");
  lines.push("- UUID collision → skip, no reassign");
  lines.push("- Same email, different customer UUID → skip, no merge");
  lines.push("- `user_roles` → manual only");
  lines.push("- FACT finance → import as-is, no workflow derivation");
  lines.push("", "## Partial promote (SQL)", "");
  lines.push(`Wired steps: \`${SQL_WIRED_STEPS.join("`, `")}\``);
  lines.push("```sql");
  lines.push(`SELECT public.legacy_promote_batch('${plan.batchKey}', true, ARRAY['customers','leads']);`);
  lines.push("```");
  return lines.join("\n");
}

function renderSkipCsv(plan: PromotePlanSummary): string {
  const header = "source_file,legacy_id,outcome,detail,review_queue";
  const lines = plan.rows
    .filter((r) => r.outcome !== "would_insert")
    .map((r) =>
      [r.sourceFile, r.legacyId, r.outcome, esc(r.detail), r.reviewQueue ? "yes" : "no"].join(","),
    );
  return [header, ...lines].join("\n");
}

function esc(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function renderYamlMapping(file: UserRolesMappingFile): string {
  const lines = [
    `# ${file.batchKey} — fill team_user_id before manual user_roles promote`,
    `batch_key: ${file.batchKey}`,
    "mappings:",
  ];
  for (const m of file.mappings) {
    lines.push(`  - legacy_user_role_id: ${m.legacy_user_role_id}`);
    lines.push(`    legacy_user_id: ${m.legacy_user_id}`);
    lines.push(`    role: ${m.role}`);
    lines.push(`    team_user_id: null  # REQUIRED: auth.users UUID on team project`);
    lines.push(`    notes: ${m.notes}`);
  }
  return lines.join("\n");
}
