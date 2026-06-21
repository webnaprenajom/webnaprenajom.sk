export type HistorySourceKind = "lead_logs" | "admin_audit_log";

export type HistoryActorType = "user" | "system";

export type HistoryEntry = {
  id: string;
  occurredAt: string;
  actorName: string | null;
  actorId: string | null;
  actorType: HistoryActorType;
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  actionType: string;
  actionLabel: string;
  module: string;
  summary: string;
  detail: Record<string, unknown> | null;
  sourceKind: HistorySourceKind;
};

export type HistoryFilters = {
  search: string;
  dateFrom: string;
  dateTo: string;
  module: string;
  actionType: string;
  entityType: string;
  actor: string;
};

export const DEFAULT_HISTORY_FILTERS: HistoryFilters = {
  search: "",
  dateFrom: "",
  dateTo: "",
  module: "all",
  actionType: "all",
  entityType: "all",
  actor: "all",
};

export type LoadCrmHistoryResult = {
  entries: HistoryEntry[];
  leadLogCount: number;
  auditLogCount: number;
  auditLogSkipped: boolean;
  errors: string[];
};
