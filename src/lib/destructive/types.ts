export type DestructiveEntityType = "customer" | "hosting" | "rental_website" | "lead";

export type DestructiveSectionSeverity = "info" | "warning";

export type LeadImpactSectionKey =
  | "customerLink"
  | "tasks"
  | "projectNotes"
  | "marketing"
  | "leadLogs";

export type LeadLinkedCustomerImpact = {
  customer_id: string;
  has_finance_facts: boolean;
  rentals_count: number;
  hosting_count: number;
};

export type LeadImpactSection = {
  key: LeadImpactSectionKey;
  severity: DestructiveSectionSeverity;
  count: number;
  action?: DestructiveSectionAction;
  linked_customer?: LeadLinkedCustomerImpact;
};

export type LeadDestructiveImpact = {
  is_risky: boolean;
  sections: LeadImpactSection[];
};

export type DestructiveSectionAction = "delete" | "detach" | "block" | "keep";

export type DestructiveImpactSection = {
  label: string;
  count: number;
  action: DestructiveSectionAction;
};

export type DestructiveBlockingRecord = {
  id: string;
  record_type: "payment_fact" | "cost_fact" | "payout_fact" | string;
  table_name: string;
  label: string;
  amount: number;
  detail?: string | null;
  cta_path: string;
};

export type DestructiveCtaLink = {
  label: string;
  path: string;
};

export type DestructiveImpactSummary = {
  entity_type: DestructiveEntityType;
  entity_id: string;
  entity_label: string;
  can_delete: boolean;
  block_reason?: string | null;
  finance_critical: boolean;
  sections: DestructiveImpactSection[];
  /** Present for entity_type === "lead" (Batch L1 precheck). */
  lead_impact?: LeadDestructiveImpact;
  warnings: string[];
  blocking_records: DestructiveBlockingRecord[];
  cta_links: DestructiveCtaLink[];
};

export type DestructiveDeleteResult = {
  ok: boolean;
  entity_type: DestructiveEntityType;
  entity_id: string;
  deleted: Record<string, number>;
  detached: Record<string, unknown>;
};

export type DestructiveDeleteRequest = {
  entityType: DestructiveEntityType;
  entityId: string;
  entityLabel?: string;
  redirectTo?: string;
};

const SECTION_ACTION_LABELS: Record<DestructiveSectionAction, string> = {
  delete: "Zmaže sa",
  detach: "Odpojí sa",
  block: "Blokuje",
  keep: "Zostane",
};

export function sectionActionLabel(action: DestructiveSectionAction): string {
  return SECTION_ACTION_LABELS[action] ?? action;
}

const RECORD_TYPE_LABELS: Record<string, string> = {
  payment_fact: "Potvrdená platba",
  cost_fact: "Potvrdený náklad",
  payout_fact: "Potvrdená výplata",
};

export function blockingRecordTypeLabel(type: string): string {
  return RECORD_TYPE_LABELS[type] ?? type;
}

const ENTITY_TYPE_LABELS: Record<DestructiveEntityType, string> = {
  customer: "Klient",
  hosting: "Hosting",
  rental_website: "Prenájom webu",
  lead: "Lead",
};

const LEAD_IMPACT_SECTION_KEYS: LeadImpactSectionKey[] = [
  "customerLink",
  "tasks",
  "projectNotes",
  "marketing",
  "leadLogs",
];

function parseLeadLinkedCustomer(raw: unknown): LeadLinkedCustomerImpact | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  if (typeof o.customer_id !== "string") return undefined;
  return {
    customer_id: o.customer_id,
    has_finance_facts: Boolean(o.has_finance_facts),
    rentals_count: Number(o.rentals_count ?? 0),
    hosting_count: Number(o.hosting_count ?? 0),
  };
}

export function parseLeadImpactSection(raw: unknown): LeadImpactSection | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const key = String(o.key ?? "");
  if (!LEAD_IMPACT_SECTION_KEYS.includes(key as LeadImpactSectionKey)) return null;
  const severity = o.severity === "warning" ? "warning" : "info";
  const action = o.action;
  return {
    key: key as LeadImpactSectionKey,
    severity,
    count: Number(o.count ?? 0),
    ...(action === "delete" ||
    action === "detach" ||
    action === "block" ||
    action === "keep"
      ? { action }
      : {}),
    linked_customer: parseLeadLinkedCustomer(o.linked_customer),
  };
}

export function parseLeadImpact(raw: unknown): LeadDestructiveImpact | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const sections = Array.isArray(o.sections)
    ? o.sections.map(parseLeadImpactSection).filter((s): s is LeadImpactSection => s != null)
    : [];
  return {
    is_risky: Boolean(o.is_risky),
    sections,
  };
}

/** Bulk delete (L3): skip leads flagged risky by precheck (finance warnings on linked customer). */
export function isLeadDeleteRisky(impact: LeadDestructiveImpact): boolean {
  return impact.is_risky;
}

export function destructiveEntityTypeLabel(type: DestructiveEntityType): string {
  return ENTITY_TYPE_LABELS[type] ?? type;
}

export function parseImpactSummary(raw: unknown): DestructiveImpactSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.entity_type !== "string" || typeof o.entity_id !== "string") return null;
  const entityType = o.entity_type as DestructiveEntityType;
  const leadImpact = entityType === "lead" ? parseLeadImpact(o.lead_impact) : undefined;

  return {
    entity_type: entityType,
    entity_id: o.entity_id,
    entity_label: String(o.entity_label ?? ""),
    can_delete: Boolean(o.can_delete),
    block_reason: o.block_reason != null ? String(o.block_reason) : null,
    finance_critical: Boolean(o.finance_critical),
    sections: Array.isArray(o.sections)
      ? (o.sections as DestructiveImpactSection[])
      : [],
    ...(leadImpact ? { lead_impact: leadImpact } : {}),
    warnings: Array.isArray(o.warnings) ? o.warnings.map(String) : [],
    blocking_records: Array.isArray(o.blocking_records)
      ? (o.blocking_records as DestructiveBlockingRecord[])
      : [],
    cta_links: Array.isArray(o.cta_links) ? (o.cta_links as DestructiveCtaLink[]) : [],
  };
}

export type LeadDeleteExecuteCounts = {
  deleted_lead_id: string;
  detached_tasks_count: number;
  detached_project_notes_count: number;
};

export function parseLeadDeleteExecuteCounts(
  result: DestructiveDeleteResult,
): LeadDeleteExecuteCounts | null {
  if (result.entity_type !== "lead" || !result.ok) return null;
  const detached = result.detached;
  return {
    deleted_lead_id: result.entity_id,
    detached_tasks_count: Number(detached.tasks ?? 0),
    detached_project_notes_count: Number(detached.project_notes ?? 0),
  };
}

export function parseDeleteResult(raw: unknown): DestructiveDeleteResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!o.ok) return null;
  return {
    ok: true,
    entity_type: o.entity_type as DestructiveEntityType,
    entity_id: String(o.entity_id),
    deleted: (o.deleted as Record<string, number>) ?? {},
    detached: (o.detached as Record<string, unknown>) ?? {},
  };
}
