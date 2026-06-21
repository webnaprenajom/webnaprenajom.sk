/**
 * Shared CRM history writer — thin wrapper over admin_audit_log (Batch A).
 */

import { logAdminAuditEvent } from "@/lib/audit/auditLog";

export const CRM_HISTORY_ACTIONS = {
  entity_created: "entity_created",
  entity_updated: "entity_updated",
  entity_deleted: "entity_deleted",
  status_changed: "status_changed",
  payment_recorded: "payment_recorded",
  payout_recorded: "payout_recorded",
  cost_recorded: "cost_recorded",
} as const;

export type CrmHistoryAction = (typeof CRM_HISTORY_ACTIONS)[keyof typeof CRM_HISTORY_ACTIONS];

export type LogCrmEventInput = {
  actorUserId: string;
  actionType: CrmHistoryAction | string;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string;
  summary: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

/** Best-effort — never blocks the primary write. */
export function logCrmEvent(input: LogCrmEventInput): void {
  void logAdminAuditEvent({
    actorUserId: input.actorUserId,
    actionType: input.actionType,
    targetType: input.entityType,
    targetId: input.entityId ?? null,
    summary: input.summary,
    before: input.before ?? null,
    after: {
      ...(input.after ?? {}),
      ...(input.entityLabel ? { title: input.entityLabel } : {}),
    },
  });
}
