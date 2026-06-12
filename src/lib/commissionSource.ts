/** Commission source linking — maps workflow rows to business entities. */

export type CommissionSourceType = "project" | "rental" | "hosting" | "other";

/** linked = type+id set; legacy = neither; partial = mismatched pair; other = type other without id requirement */
export type CommissionLinkStatus = "linked" | "legacy" | "partial" | "other";

export const COMMISSION_LINK_STATUS_LABELS: Record<CommissionLinkStatus, string> = {
  linked: "Prepojené",
  legacy: "Bez zdroja",
  partial: "Neúplné prepojenie",
  other: "Iný zdroj",
};

export const COMMISSION_SOURCE_LABELS: Record<CommissionSourceType, string> = {
  project: "Projekt",
  rental: "Prenájom",
  hosting: "Hosting",
  other: "Iné",
};

export interface CommissionRow {
  id: string;
  title: string;
  implementer: string;
  amount: number;
  payment_status: string;
  note: string | null;
  date: string;
  source_type?: CommissionSourceType | string | null;
  source_id?: string | null;
  customer_email?: string | null;
  payment_form?: string | null;
}

export interface SourceLabelContext {
  projects?: Map<string, { title: string }>;
  rentals?: Map<string, { name: string }>;
  hosting?: Map<string, { label: string }>;
}

export function commissionMatchesSource(
  row: CommissionRow,
  sourceType: CommissionSourceType,
  sourceId: string,
): boolean {
  return row.source_type === sourceType && row.source_id === sourceId;
}

export function resolveCommissionSourceLabel(
  row: CommissionRow,
  ctx: SourceLabelContext = {},
): string {
  const type = row.source_type as CommissionSourceType | null | undefined;
  if (!type || type === "other") return row.title;

  const id = row.source_id;
  if (type === "project" && id && ctx.projects?.has(id)) {
    return ctx.projects.get(id)!.title;
  }
  if (type === "rental" && id && ctx.rentals?.has(id)) {
    return ctx.rentals.get(id)!.name;
  }
  if (type === "hosting" && id && ctx.hosting?.has(id)) {
    return ctx.hosting.get(id)!.label;
  }

  const typeLabel = COMMISSION_SOURCE_LABELS[type] ?? type;
  return id ? `${typeLabel} · ${row.title}` : row.title;
}

export function sourceDetailHref(
  sourceType: CommissionSourceType | string | null | undefined,
  sourceId: string | null | undefined,
): string | null {
  if (!sourceType || !sourceId) return null;
  switch (sourceType) {
    case "project":
      return `/admin/projects/${sourceId}`;
    case "rental":
      return `/admin/rentals?website=${sourceId}`;
    case "hosting":
      return `/admin/hosting/${sourceId}`;
    default:
      return null;
  }
}

const ENTITY_SOURCE_TYPES = new Set<CommissionSourceType>(["project", "rental", "hosting"]);

export function getCommissionLinkStatus(row: {
  source_type?: CommissionSourceType | string | null;
  source_id?: string | null;
}): CommissionLinkStatus {
  const type = (row.source_type || "").trim() as CommissionSourceType | "";
  const id = (row.source_id || "").trim();

  if (type === "other") return "other";
  if (!type && !id) return "legacy";
  if (type && ENTITY_SOURCE_TYPES.has(type as CommissionSourceType) && id) return "linked";
  return "partial";
}

export function isCommissionLinked(row: {
  source_type?: CommissionSourceType | string | null;
  source_id?: string | null;
}): boolean {
  return getCommissionLinkStatus(row) === "linked";
}

export interface SanitizedCommissionSource {
  source_type: CommissionSourceType | null;
  source_id: string | null;
}

/** Normalize source fields — never persist partial type/id pairs. */
export function sanitizeCommissionSourceFields(
  sourceType: CommissionSourceType | string | null | undefined,
  sourceId: string | null | undefined,
): SanitizedCommissionSource {
  const type = (sourceType || "").trim() as CommissionSourceType | "";
  const id = (sourceId || "").trim();

  if (!type) {
    return { source_type: null, source_id: null };
  }
  if (type === "other") {
    return { source_type: "other", source_id: null };
  }
  if (ENTITY_SOURCE_TYPES.has(type as CommissionSourceType) && id) {
    return { source_type: type as CommissionSourceType, source_id: id };
  }
  return { source_type: null, source_id: null };
}

export interface CommissionSourceValidation {
  valid: boolean;
  error?: string;
  warning?: string;
}

export function validateCommissionSourceFields(
  sourceType: CommissionSourceType | string | null | undefined,
  sourceId: string | null | undefined,
): CommissionSourceValidation {
  const type = (sourceType || "").trim();
  const id = (sourceId || "").trim();

  if (!type && id) {
    return {
      valid: false,
      error: "Riadok má source_id bez typu zdroja. Vyberte typ alebo odstráňte entitu.",
    };
  }
  if (type && type !== "other" && ENTITY_SOURCE_TYPES.has(type as CommissionSourceType) && !id) {
    return {
      valid: false,
      error: `Pre typ „${COMMISSION_SOURCE_LABELS[type as CommissionSourceType]}“ vyberte konkrétny záznam.`,
    };
  }
  if (type === "other" && id) {
    return {
      valid: true,
      warning: "Pri type „Iné“ sa source_id neukladá.",
    };
  }
  return { valid: true };
}
