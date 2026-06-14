/**
 * Admin audit trail (Batch RC6.6).
 */

import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { buildAuditSummary } from "@/lib/audit/auditLogFormat";

export { buildAuditSummary } from "@/lib/audit/auditLogFormat";

export const AUDIT_ACTION_TYPES = {
  role_assigned: "role_assigned",
  role_removed: "role_removed",
  team_profile_assigned: "team_profile_assigned",
  team_profile_updated: "team_profile_updated",
  commission_status_changed: "commission_status_changed",
  operating_cost_changed: "operating_cost_changed",
  finance_config_changed: "finance_config_changed",
  entity_deleted: "entity_deleted",
} as const;

export type AuditActionType = (typeof AUDIT_ACTION_TYPES)[keyof typeof AUDIT_ACTION_TYPES];

export type AuditLogEntry = {
  id: string;
  actor_user_id: string;
  action_type: AuditActionType | string;
  target_type: string;
  target_id: string | null;
  summary: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  created_at: string;
};

export type AuditLogInput = {
  actorUserId: string;
  actionType: AuditActionType | string;
  targetType: string;
  targetId?: string | null;
  summary?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

type AdminAuditInsert = Database["public"]["Tables"]["admin_audit_log"]["Insert"];

/** Best-effort audit insert — failures are logged, never block primary action. */
export async function logAdminAuditEvent(input: AuditLogInput): Promise<void> {
  try {
    const payload: AdminAuditInsert = {
      actor_user_id: input.actorUserId,
      action_type: input.actionType,
      target_type: input.targetType,
      target_id: input.targetId ?? null,
      summary: input.summary ?? buildAuditSummary(input.actionType, input.targetId || input.targetType),
      before_state: (input.before ?? null) as Json | null,
      after_state: (input.after ?? null) as Json | null,
    };
    const { error } = await supabase.from("admin_audit_log").insert(payload);
    if (error) {
      console.error("[audit] insert failed", error.message);
    }
  } catch (err) {
    console.error("[audit] unexpected failure", err);
  }
}

export async function loadRecentAuditLog(limit = 50): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase
    .from("admin_audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[audit] load failed", error.message);
    return [];
  }
  return (data || []) as AuditLogEntry[];
}

export async function loadAuditForTarget(targetType: string, targetId: string, limit = 5): Promise<AuditLogEntry[]> {
  const { data } = await supabase
    .from("admin_audit_log")
    .select("*")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data || []) as AuditLogEntry[];
}
