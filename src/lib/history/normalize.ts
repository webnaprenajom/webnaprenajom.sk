import type { AuditLogEntry } from "@/lib/audit/auditLog";
import {
  auditActionLabel,
  historyEntityTypeLabel,
  historyModuleForEntity,
  leadActionLabel,
  leadActionTypeFromRow,
  leadFieldLabel,
} from "@/lib/history/labels";
import type { HistoryEntry } from "@/lib/history/types";
import {
  formatActorLabel,
  type HistoricalIdentityContext,
} from "@/lib/identity/historicalIdentity";

export type LeadLogRow = {
  id: string;
  lead_id: string | null;
  lead_name: string | null;
  lead_email: string | null;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  changed_by_email: string | null;
  changed_by_id: string | null;
  created_at: string;
};

function buildLeadSummary(row: LeadLogRow): string {
  const who = row.lead_name || row.lead_email || "lead";
  if (row.action === "created") return `Vytvorený lead: ${who}`;
  if (row.action === "deleted") return `Vymazaný lead: ${who}`;
  if (row.action === "notification") return `Notifikácia: ${who}`;
  if (row.action === "wheel_spin") return `Koleso šťastia: ${who}`;
  if (row.action === "updated" && row.field) {
    const field = leadFieldLabel(row.field);
    const from = row.old_value ?? "—";
    const to = row.new_value ?? "—";
    return `${who}: ${field} ${from} → ${to}`;
  }
  return `${who}: ${row.action}`;
}

export function normalizeLeadLog(row: LeadLogRow): HistoryEntry {
  const entityLabel = row.lead_name || row.lead_email;
  const detail: Record<string, unknown> = {};
  if (row.field) detail.field = row.field;
  if (row.old_value != null) detail.old_value = row.old_value;
  if (row.new_value != null) detail.new_value = row.new_value;
  if (row.lead_email) detail.lead_email = row.lead_email;

  return {
    id: `lead_logs:${row.id}`,
    occurredAt: row.created_at,
    actorName: row.changed_by_email,
    actorId: row.changed_by_id,
    actorType: row.changed_by_email || row.changed_by_id ? "user" : "system",
    entityType: "lead",
    entityId: row.lead_id,
    entityLabel,
    actionType: leadActionTypeFromRow(row.action, row.field),
    actionLabel: leadActionLabel(row.action, row.field),
    module: "Leady",
    summary: buildLeadSummary(row),
    detail: Object.keys(detail).length ? detail : null,
    sourceKind: "lead_logs",
  };
}

function buildAuditSummary(entry: AuditLogEntry, actorName: string | null): string {
  if (entry.summary?.trim()) return entry.summary.trim();
  const entity = historyEntityTypeLabel(entry.target_type);
  const label = auditActionLabel(entry.action_type);
  const actor = actorName ? ` (${actorName})` : "";
  return `${label}: ${entity}${entry.target_id ? ` ${entry.target_id.slice(0, 8)}` : ""}${actor}`;
}

export function normalizeAuditLog(
  entry: AuditLogEntry,
  actorEmails: Map<string, string>,
  historicalCtx?: HistoricalIdentityContext | null,
): HistoryEntry {
  const liveName = entry.actor_user_id ? actorEmails.get(entry.actor_user_id) ?? null : null;
  const actorName = formatActorLabel(entry.actor_user_id, liveName, historicalCtx ?? null);
  const detail: Record<string, unknown> = {};
  if (entry.before_state) detail.before = entry.before_state;
  if (entry.after_state) detail.after = entry.after_state;

  const entityType = entry.target_type;
  const entityLabel =
    (entry.after_state?.title as string | undefined) ??
    (entry.after_state?.name as string | undefined) ??
    (entry.before_state?.entity_label as string | undefined) ??
    (entry.summary?.split(":")[1]?.trim()) ??
    null;

  return {
    id: `admin_audit_log:${entry.id}`,
    occurredAt: entry.created_at,
    actorName,
    actorId: entry.actor_user_id,
    actorType: entry.actor_user_id ? "user" : "system",
    entityType,
    entityId: entry.target_id,
    entityLabel,
    actionType: entry.action_type,
    actionLabel: auditActionLabel(entry.action_type),
    module: historyModuleForEntity(entityType),
    summary: buildAuditSummary(entry, actorName),
    detail: Object.keys(detail).length ? detail : null,
    sourceKind: "admin_audit_log",
  };
}

export function mergeHistoryEntries(entries: HistoryEntry[]): HistoryEntry[] {
  return [...entries].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
}
