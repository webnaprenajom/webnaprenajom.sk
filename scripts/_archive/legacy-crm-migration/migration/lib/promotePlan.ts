import type { SupabaseClient } from "@supabase/supabase-js";
import { TEAM_PROJECT_REF } from "./analyzeConflicts.js";
import { normalizeEmail } from "./normalizeIdentity.js";
import {
  ORPHAN_LEAD_LOG_POLICY,
  PROMOTE_ORDER,
  type PromoteOutcome,
  type PromotePlanRow,
  type PromotePlanSummary,
} from "./promotePolicies.js";
import { MIGRATION_SOURCES, promotePolicyFor } from "./sources.js";
import type { StagedRow } from "./types.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Index = Map<string, Set<string>>;

type EvalResult = { outcome: PromoteOutcome; detail: string; reviewQueue: boolean };

export async function buildPromotePlan(input: {
  batchKey: string;
  dryRun: boolean;
  stagedRows: StagedRow[];
  supabase: SupabaseClient;
}): Promise<PromotePlanSummary> {
  const { batchKey, dryRun, stagedRows, supabase } = input;
  const legacyIndex = buildIndex(stagedRows);
  const planRows: PromotePlanRow[] = [];

  const teamIdsByTable = await prefetchTeamIds(supabase, stagedRows);
  const teamEmails = await prefetchTeamCustomerEmails(supabase);
  const duplicateLeadEmails = buildDuplicateLeadEmails(stagedRows);
  const customerEmailToIds = buildCustomerEmailIndex(stagedRows);

  for (const sourceFile of PROMOTE_ORDER) {
    const def = MIGRATION_SOURCES.find((s) => s.sourceFile === sourceFile);
    if (!def?.canonicalTable) continue;

    const policy = promotePolicyFor(def);
    const rows = stagedRows.filter((r) => r.sourceFile === sourceFile);

    for (const row of rows) {
      const evalResult = evaluateRow({
        row,
        sourceFile,
        canonicalTable: def.canonicalTable,
        policy,
        dryRun,
        legacyIndex,
        teamIdsByTable,
        teamEmails,
        duplicateLeadEmails,
        customerEmailToIds,
      });
      planRows.push({
        sourceFile: row.sourceFile,
        entityType: row.entityType,
        canonicalTable: def.canonicalTable,
        legacyId: row.legacyId,
        ...evalResult,
      });
    }
  }

  return summarizePlan(batchKey, dryRun, planRows);
}

function evaluateRow(ctx: {
  row: StagedRow;
  sourceFile: string;
  canonicalTable: string;
  policy: ReturnType<typeof promotePolicyFor>;
  dryRun: boolean;
  legacyIndex: Index;
  teamIdsByTable: Map<string, Set<string>>;
  teamEmails: Set<string>;
  duplicateLeadEmails: Set<string>;
  customerEmailToIds: Map<string, Set<string>>;
}): EvalResult {
  const {
    row,
    sourceFile,
    canonicalTable,
    policy,
    dryRun,
    legacyIndex,
    teamIdsByTable,
    teamEmails,
    duplicateLeadEmails,
    customerEmailToIds,
  } = ctx;

  if (policy === "manual") {
    return { outcome: "skip_manual_only", detail: "Manual-only — map auth.users first", reviewQueue: true };
  }
  if (policy === "skip") {
    return { outcome: "skip_promote_policy", detail: "Promote policy: skip", reviewQueue: false };
  }

  if (!UUID_RE.test(row.legacyId)) {
    return { outcome: "skip_ambiguous_identity", detail: "Invalid legacy UUID", reviewQueue: true };
  }

  if (teamIdsByTable.get(canonicalTable)?.has(row.legacyId)) {
    return {
      outcome: "skip_uuid_collision",
      detail: `UUID exists in team ${canonicalTable}`,
      reviewQueue: true,
    };
  }

  if (canonicalTable === "customers") {
    const email = normalizeEmail(row.payload.email);
    if (email && teamEmails.has(email)) {
      return {
        outcome: "skip_email_collision",
        detail: `Email ${email} on team customer — no auto-merge`,
        reviewQueue: true,
      };
    }
  }

  if (sourceFile === "lead_logs.csv" && ORPHAN_LEAD_LOG_POLICY === "skip") {
    const leadId = (row.payload.lead_id ?? "").trim();
    if (!leadId || !leadExists(leadId, legacyIndex, teamIdsByTable)) {
      return {
        outcome: "skip_orphan_fk",
        detail: `lead_id=${leadId || "(empty)"} missing — OPTION A skip`,
        reviewQueue: true,
      };
    }
  }

  if (sourceFile === "leads.csv") {
    const email = normalizeEmail(row.payload.email);
    const cid = (row.payload.customer_id ?? "").trim();
    if (!cid && email) {
      const candidates = customerEmailToIds.get(email);
      if (!candidates?.size) {
        return {
          outcome: "skip_ambiguous_identity",
          detail: "Missing customer_id; no export customer for email — no auto-create",
          reviewQueue: true,
        };
      }
      if (candidates.size > 1) {
        return {
          outcome: "skip_ambiguous_identity",
          detail: `Email ${email} → multiple customers — no auto-merge`,
          reviewQueue: true,
        };
      }
    }
  }

  if (sourceFile === "rental_websites.csv" || sourceFile === "hosting_records.csv") {
    if (!(row.payload.customer_id ?? "").trim()) {
      const bridged = resolveCustomerId(row.payload, legacyIndex, teamIdsByTable, customerEmailToIds);
      if (!bridged.ok) {
        return { outcome: bridged.outcome, detail: bridged.detail, reviewQueue: true };
      }
    }
  }

  const def = MIGRATION_SOURCES.find((s) => s.sourceFile === sourceFile);
  for (const fk of def?.fkFields ?? []) {
    if (sourceFile === "lead_logs.csv" && fk.field === "lead_id") continue;
    const ref = (row.payload[fk.field] ?? "").trim();
    if (!ref) continue;

    if (fk.field === "customer_id") {
      const resolved = resolveCustomerId(row.payload, legacyIndex, teamIdsByTable, customerEmailToIds);
      if (!resolved.ok) {
        return { outcome: resolved.outcome, detail: resolved.detail, reviewQueue: true };
      }
      continue;
    }

    const inStaging = legacyIndex.get(fk.targetSourceFile)?.has(ref);
    const inTeam = teamIdsByTable.get(tableForSource(fk.targetSourceFile))?.has(ref);
    if (!inStaging && !inTeam) {
      return {
        outcome: "skip_orphan_fk",
        detail: `${fk.field}=${ref} missing in staging and team`,
        reviewQueue: true,
      };
    }
  }

  const email = normalizeEmail(row.payload.email);
  const reviewQueue = sourceFile === "leads.csv" && !!email && duplicateLeadEmails.has(email);

  return {
    outcome: "would_insert",
    detail: dryRun ? "Would insert (dry-run)" : "Eligible for insert",
    reviewQueue,
  };
}

function buildIndex(rows: StagedRow[]): Index {
  const map = new Map<string, Set<string>>();
  for (const r of rows) {
    const set = map.get(r.sourceFile) ?? new Set();
    set.add(r.legacyId);
    map.set(r.sourceFile, set);
  }
  return map;
}

function buildCustomerEmailIndex(rows: StagedRow[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const r of rows.filter((x) => x.sourceFile === "customers.csv")) {
    const email = normalizeEmail(r.payload.email);
    if (!email) continue;
    const set = map.get(email) ?? new Set();
    set.add(r.legacyId);
    map.set(email, set);
  }
  return map;
}

function buildDuplicateLeadEmails(rows: StagedRow[]): Set<string> {
  const byEmail = new Map<string, number>();
  for (const r of rows.filter((x) => x.sourceFile === "leads.csv")) {
    const email = normalizeEmail(r.payload.email);
    if (!email) continue;
    byEmail.set(email, (byEmail.get(email) ?? 0) + 1);
  }
  return new Set([...byEmail.entries()].filter(([, n]) => n > 1).map(([e]) => e));
}

function leadExists(leadId: string, legacyIndex: Index, teamIds: Map<string, Set<string>>): boolean {
  return (
    legacyIndex.get("leads.csv")?.has(leadId) === true || teamIds.get("leads")?.has(leadId) === true
  );
}

function tableForSource(sourceFile: string): string {
  return MIGRATION_SOURCES.find((s) => s.sourceFile === sourceFile)?.canonicalTable ?? "";
}

function resolveCustomerId(
  payload: StagedRow["payload"],
  legacyIndex: Index,
  teamIds: Map<string, Set<string>>,
  emailIndex: Map<string, Set<string>>,
): { ok: true; id: string } | { ok: false; outcome: PromoteOutcome; detail: string } {
  const cid = (payload.customer_id ?? "").trim();
  if (cid) {
    if (legacyIndex.get("customers.csv")?.has(cid) || teamIds.get("customers")?.has(cid)) {
      return { ok: true, id: cid };
    }
    return { ok: false, outcome: "skip_orphan_fk", detail: `customer_id=${cid} not found` };
  }

  const email = normalizeEmail(payload.customer_email ?? payload.email);
  if (!email) {
    return { ok: false, outcome: "skip_ambiguous_identity", detail: "No customer_id or bridge email" };
  }

  const exportIds = emailIndex.get(email);
  if (!exportIds?.size) {
    return {
      ok: false,
      outcome: "skip_ambiguous_identity",
      detail: `No export customer for email ${email} — no auto-create`,
    };
  }
  if (exportIds.size > 1) {
    return {
      ok: false,
      outcome: "skip_ambiguous_identity",
      detail: `Email ${email} → ${exportIds.size} customers — no auto-merge`,
    };
  }
  return { ok: true, id: [...exportIds][0] };
}

async function prefetchTeamIds(
  supabase: SupabaseClient,
  stagedRows: StagedRow[],
): Promise<Map<string, Set<string>>> {
  const tables = new Set<string>();
  for (const r of stagedRows) {
    const def = MIGRATION_SOURCES.find((s) => s.sourceFile === r.sourceFile);
    if (def?.canonicalTable) tables.add(def.canonicalTable);
  }

  const result = new Map<string, Set<string>>();
  for (const table of tables) {
    const ids = stagedRows
      .filter((r) => MIGRATION_SOURCES.find((s) => s.sourceFile === r.sourceFile)?.canonicalTable === table)
      .map((r) => r.legacyId)
      .filter((id) => UUID_RE.test(id));

    const set = new Set<string>();
    for (let i = 0; i < ids.length; i += 80) {
      const chunk = ids.slice(i, i + 80);
      const { data, error } = await supabase.from(table).select("id").in("id", chunk);
      if (error) {
        console.warn(`prefetch ${table}: ${error.message}`);
        continue;
      }
      for (const row of data ?? []) set.add(row.id as string);
    }
    result.set(table, set);
  }
  return result;
}

async function prefetchTeamCustomerEmails(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase.from("customers").select("email");
  if (error) {
    console.warn(`prefetch customer emails: ${error.message}`);
    return new Set();
  }
  const emails = new Set<string>();
  for (const row of data ?? []) {
    const e = normalizeEmail(row.email);
    if (e) emails.add(e);
  }
  return emails;
}

function summarizePlan(batchKey: string, dryRun: boolean, rows: PromotePlanRow[]): PromotePlanSummary {
  const byOutcome = {} as Record<PromoteOutcome, number>;
  for (const o of [
    "would_insert",
    "skip_uuid_collision",
    "skip_email_collision",
    "skip_orphan_fk",
    "skip_ambiguous_identity",
    "skip_manual_only",
    "skip_promote_policy",
    "skip_empty",
  ] as PromoteOutcome[]) {
    byOutcome[o] = 0;
  }
  for (const r of rows) byOutcome[r.outcome] = (byOutcome[r.outcome] ?? 0) + 1;

  const bySourceMap = new Map<string, { wouldInsert: number; skipped: number; reviewQueue: number }>();
  for (const r of rows) {
    const cur = bySourceMap.get(r.sourceFile) ?? { wouldInsert: 0, skipped: 0, reviewQueue: 0 };
    if (r.outcome === "would_insert") cur.wouldInsert++;
    else cur.skipped++;
    if (r.reviewQueue) cur.reviewQueue++;
    bySourceMap.set(r.sourceFile, cur);
  }

  return {
    batchKey,
    dryRun,
    targetProjectRef: TEAM_PROJECT_REF,
    byOutcome,
    bySource: [...bySourceMap.entries()].map(([sourceFile, stats]) => ({ sourceFile, ...stats })),
    rows,
  };
}
