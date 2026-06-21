import { supabase } from "@/integrations/supabase/client";
import type { AuditLogEntry } from "@/lib/audit/auditLog";
import {
  mergeHistoryEntries,
  normalizeAuditLog,
  normalizeLeadLog,
  type LeadLogRow,
} from "@/lib/history/normalize";
import type { LoadCrmHistoryResult } from "@/lib/history/types";
import { isLeadLogsPermissionError } from "@/lib/leads/leadLogsPresentation";
import { loadCrmUserArchives } from "@/lib/admin/crmUserRemoval";
import {
  buildHistoricalIdentityContext,
  formatActorLabel,
  type HistoricalIdentityContext,
} from "@/lib/identity/historicalIdentity";

const HISTORY_LIMIT = 1000;

async function loadActorEmails(
  userIds: string[],
  archives: Awaited<ReturnType<typeof loadCrmUserArchives>>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const row of archives) {
    if (row.user_id && row.email) map.set(row.user_id, row.email);
    if (row.user_id && row.display_name && !map.has(row.user_id)) {
      map.set(row.user_id, row.display_name);
    }
  }
  if (userIds.length === 0) return map;
  try {
    const { data, error } = await supabase.rpc("admin_list_auth_users");
    if (error || !data) return map;
    for (const row of data as { user_id: string; email: string }[]) {
      if (row.user_id && row.email) map.set(row.user_id, row.email);
    }
  } catch {
    // ponytail: actor map is best-effort; History still works without emails
  }
  return map;
}

export async function loadCrmHistory(opts: {
  includeAuditLog: boolean;
  limit?: number;
}): Promise<LoadCrmHistoryResult> {
  const limit = opts.limit ?? HISTORY_LIMIT;
  const errors: string[] = [];

  const leadPromise = supabase
    .from("lead_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  const auditPromise = opts.includeAuditLog
    ? supabase.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(limit)
    : Promise.resolve({ data: null, error: null });

  const [leadRes, auditRes, archives, profilesRes, registryRes] = await Promise.all([
    leadPromise,
    auditPromise,
    loadCrmUserArchives(),
    supabase.from("team_profiles").select("implementer_name,active").eq("active", true),
    supabase.from("crm_implementers").select("name,active"),
  ]);

  let leadRows: LeadLogRow[] = [];
  if (leadRes.error) {
    if (!isLeadLogsPermissionError(leadRes.error.message)) {
      errors.push(`lead_logs: ${leadRes.error.message}`);
    }
  } else {
    leadRows = (leadRes.data || []) as LeadLogRow[];
  }

  let auditRows: AuditLogEntry[] = [];
  let auditLogSkipped = !opts.includeAuditLog;
  if (opts.includeAuditLog) {
    if (auditRes.error) {
      auditLogSkipped = true;
      if (!isLeadLogsPermissionError(auditRes.error.message)) {
        errors.push(`admin_audit_log: ${auditRes.error.message}`);
      }
    } else {
      auditRows = (auditRes.data || []) as AuditLogEntry[];
    }
  }

  const actorIds = [...new Set(auditRows.map((r) => r.actor_user_id).filter(Boolean))] as string[];
  const actorEmails = await loadActorEmails(actorIds, archives);

  const registryNames = (registryRes.data || [])
    .filter((r) => r.active !== false)
    .map((r) => String(r.name ?? "").trim())
    .filter(Boolean);
  const profileNames = (profilesRes.data || [])
    .map((p) => String(p.implementer_name ?? "").trim())
    .filter((n) => n && !n.includes("__off__"));
  const historicalCtx: HistoricalIdentityContext = buildHistoricalIdentityContext({
    archives,
    activeImplementerNames: [...registryNames, ...profileNames],
  });

  const normalized = [
    ...leadRows.map((row) => {
      const entry = normalizeLeadLog(row);
      if (entry.actorId && historicalCtx.archivedUserIds.has(entry.actorId)) {
        return {
          ...entry,
          actorName: formatActorLabel(entry.actorId, entry.actorName, historicalCtx),
        };
      }
      return entry;
    }),
    ...auditRows.map((r) => normalizeAuditLog(r, actorEmails, historicalCtx)),
  ];

  return {
    entries: mergeHistoryEntries(normalized).slice(0, limit),
    leadLogCount: leadRows.length,
    auditLogCount: auditRows.length,
    auditLogSkipped,
    errors,
  };
}
