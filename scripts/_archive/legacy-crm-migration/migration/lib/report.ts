import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { redactReportForOutput } from "./redact.js";
import type { MigrationReport, ReviewItem } from "./types.js";

export function writeMigrationReports(
  report: MigrationReport,
  outDir: string,
): { jsonPath: string; mdPath: string; reviewCsvPath: string } {
  mkdirSync(outDir, { recursive: true });
  const safeBatch = report.batchKey.replace(/[^a-zA-Z0-9_-]/g, "_");
  const jsonPath = join(outDir, `migration-report-${safeBatch}.json`);
  const mdPath = join(outDir, `migration-report-${safeBatch}.md`);
  const reviewCsvPath = join(outDir, `review-queue-${safeBatch}.csv`);

  const safeReport = redactReportForOutput(report);
  writeFileSync(jsonPath, JSON.stringify(safeReport, null, 2), "utf8");
  writeFileSync(mdPath, renderMarkdownReport(safeReport), "utf8");
  writeFileSync(reviewCsvPath, renderReviewCsv(collectReviewItems(safeReport)), "utf8");

  return { jsonPath, mdPath, reviewCsvPath };
}

function collectReviewItems(report: MigrationReport): ReviewItem[] {
  const { analysis, reconciliation } = report;
  return [
    ...analysis.uuidCollisions,
    ...(analysis.customerEmailCollisions ?? []),
    ...analysis.duplicateEmailGroups.map((g) => ({
      entityType: "lead",
      legacyId: g.legacyIds[0] ?? null,
      sourceFile: g.sourceFile,
      reason: "duplicate_email" as const,
      detail: `Email ${g.email} on ${g.legacyIds.length} leads`,
      candidates: g.legacyIds,
    })),
    ...analysis.customerMatchHints.filter((i) => i.detail.includes("Multiple")),
    ...analysis.orphanFkRisks,
    ...(reconciliation?.identityGaps ?? []),
    ...(reconciliation?.crossEmailCustomerLeadMismatches ?? []),
    ...analysis.sensitivePayloads.map((i) => ({
      ...i,
      detail: i.detail.replace(/password|username|credentials/gi, "[field]"),
    })),
  ];
}

function renderReviewCsv(items: ReviewItem[]): string {
  const header = "entity_type,legacy_id,source_file,reason,detail";
  const lines = items.map((item) =>
    [
      csvEscape(item.entityType),
      csvEscape(item.legacyId ?? ""),
      csvEscape(item.sourceFile),
      csvEscape(item.reason),
      csvEscape(item.detail),
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function renderMarkdownReport(report: MigrationReport): string {
  const lines: string[] = [
    `# Legacy CRM Migration Report — ${report.batchKey}`,
    "",
    `- **Dry run:** ${report.dryRun}`,
    `- **Target:** team Supabase \`${report.targetProjectRef}\``,
    `- **Directory:** ${report.dir}`,
    `- **Started:** ${report.startedAt}`,
    `- **Finished:** ${report.finishedAt}`,
    "",
    "## Totals",
    "",
    `| Metric | Count |`,
    `|--------|------:|`,
    `| Rows parsed | ${report.totals.rowsParsed} |`,
    `| Rows staged (entity/activity) | ${report.totals.rowsStaged} |`,
    `| Finance rows staged | ${report.totals.financeRowsStaged} |`,
    `| Review items | ${report.totals.reviewItems} |`,
    `| Would promote (migrate policy) | ${report.totals.wouldPromote} |`,
    `| Would skip (empty/manual/skip policy) | ${report.totals.wouldSkip} |`,
    `| Manual review rows | ${report.totals.manualReview} |`,
    "",
    "## Import stats",
    "",
    "| Source | Parsed | Inserted | Updated | Unchanged | Skipped |",
    "|--------|-------:|---------:|--------:|----------:|--------:|",
  ];

  for (const s of report.importStats) {
    lines.push(
      `| ${s.sourceFile} | ${s.rowsParsed} | ${s.inserted} | ${s.updated} | ${s.unchanged} | ${s.skipped} |`,
    );
  }

  lines.push("", "## Review summary", "");
  for (const [reason, count] of Object.entries(report.analysis.reviewSummary)) {
    lines.push(`- **${reason}:** ${count}`);
  }

  lines.push("", "## Duplicate email groups", "");
  if (report.analysis.duplicateEmailGroups.length === 0) {
    lines.push("_None_");
  } else {
    for (const g of report.analysis.duplicateEmailGroups) {
      lines.push(`- \`${g.email}\` → ${g.legacyIds.length} leads (${g.legacyIds.join(", ")})`);
    }
  }

  lines.push("", "## UUID collisions (sample)", "");
  appendSample(lines, report.analysis.uuidCollisions, 10);
  lines.push("", "## Orphan FK risks (sample)", "");
  appendSample(lines, report.analysis.orphanFkRisks, 15);
  lines.push("", "## Sensitive payloads", "");
  lines.push(`Count: ${report.analysis.sensitivePayloads.length} (values redacted in reports)`);

  if (report.reconciliation) {
    const r = report.reconciliation;
    lines.push("", "## Reconciliation", "");
    lines.push(`- FACT payment_records: ${r.factLayer.paymentRecords}`);
    lines.push(`- FACT cost_records: ${r.factLayer.costRecords}`);
    lines.push(`- FACT payout_records: ${r.factLayer.payoutRecords}`);
    lines.push(`- FACT derived from workflow in export: ${r.factLayer.derivedFromWorkflowInExport}`);
    lines.push(`- Rule: ${r.factLayer.rule}`);
    lines.push("", "### Promote plan", "");
    lines.push("| Source | Rows | Policy | Staging |");
    lines.push("|--------|-----:|--------|---------|");
    for (const p of r.promotePlan) {
      lines.push(`| ${p.sourceFile} | ${p.rowCount} | ${p.promotePolicy} | ${p.stagingTable} |`);
    }
    if (r.manualOnly.length) {
      lines.push("", "### Manual only", "");
      for (const m of r.manualOnly) {
        lines.push(`- ${m.sourceFile}: ${m.rowCount} rows — ${m.note}`);
      }
    }
    if (r.exportCustomerEmailDupes.length) {
      lines.push("", "### Export customer email dupes", "");
      for (const d of r.exportCustomerEmailDupes) {
        lines.push(`- \`${d.email}\` → ${d.legacyIds.join(", ")}`);
      }
    }
    lines.push("", "### Identity gaps (sample)", "");
    appendSample(lines, r.identityGaps, 15);
  }

  lines.push("", "## Customer email collisions with team DB (sample)", "");
  appendSample(lines, report.analysis.customerEmailCollisions ?? [], 10);

  return lines.join("\n");
}

function appendSample(lines: string[], items: ReviewItem[], max: number) {
  if (items.length === 0) {
    lines.push("_None_");
    return;
  }
  for (const item of items.slice(0, max)) {
    lines.push(`- [${item.reason}] ${item.sourceFile} / ${item.legacyId}: ${item.detail}`);
  }
  if (items.length > max) lines.push(`- _…and ${items.length - max} more_`);
}
