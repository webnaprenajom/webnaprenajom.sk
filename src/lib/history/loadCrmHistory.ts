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

const HISTORY_LIMIT = 1000;

async function loadActorEmails(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
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

  const [leadRes, auditRes] = await Promise.all([leadPromise, auditPromise]);

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
  const actorEmails = await loadActorEmails(actorIds);

  const normalized = [
    ...leadRows.map(normalizeLeadLog),
    ...auditRows.map((r) => normalizeAuditLog(r, actorEmails)),
  ];

  return {
    entries: mergeHistoryEntries(normalized).slice(0, limit),
    leadLogCount: leadRows.length,
    auditLogCount: auditRows.length,
    auditLogSkipped,
    errors,
  };
}
