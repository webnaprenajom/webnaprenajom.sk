export type DestructiveEntityType = "customer" | "hosting" | "rental_website";

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
};

export function destructiveEntityTypeLabel(type: DestructiveEntityType): string {
  return ENTITY_TYPE_LABELS[type] ?? type;
}

export function parseImpactSummary(raw: unknown): DestructiveImpactSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.entity_type !== "string" || typeof o.entity_id !== "string") return null;
  return {
    entity_type: o.entity_type as DestructiveEntityType,
    entity_id: o.entity_id,
    entity_label: String(o.entity_label ?? ""),
    can_delete: Boolean(o.can_delete),
    block_reason: o.block_reason != null ? String(o.block_reason) : null,
    finance_critical: Boolean(o.finance_critical),
    sections: Array.isArray(o.sections)
      ? (o.sections as DestructiveImpactSection[])
      : [],
    warnings: Array.isArray(o.warnings) ? o.warnings.map(String) : [],
    blocking_records: Array.isArray(o.blocking_records)
      ? (o.blocking_records as DestructiveBlockingRecord[])
      : [],
    cta_links: Array.isArray(o.cta_links) ? (o.cta_links as DestructiveCtaLink[]) : [],
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
