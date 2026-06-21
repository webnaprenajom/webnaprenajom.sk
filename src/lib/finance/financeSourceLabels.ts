/**
 * Read-side mapping: source_table / source_id → user-friendly finance origin labels.
 * ponytail: composite task source_id `${uuid}:deposit|full` parsed here only — no DB change.
 */

import {
  paymentRecordHasLiveDealParent,
  type CommissionParentContext,
} from "@/lib/finance/rentalCommissionEntitlement";

export type FinanceOriginKind =
  | "hosting"
  | "project"
  | "task"
  | "marketing"
  | "rental"
  | "commission"
  | "expense"
  | "unlinked"
  | "other";

/** Entity kinds shown in confirmed payment KPI breakdown */
export type FinanceEntityKind = "hosting" | "project" | "task" | "marketing" | "rental" | "other";

export const FINANCE_SOURCE_TABLE_LABELS: Record<string, string> = {
  hosting_records: "Hosting",
  project_notes: "Projekty",
  tasks: "Úlohy",
  marketing_records: "Marketing",
  rental_payments: "Prenájmy",
  commissions: "Provízie",
  expenses: "Náklady",
  rental_credits: "AI kredity",
  rental_websites: "Prenájom",
  payment_records: "Platby (ledger)",
  payout_records: "Výplaty (ledger)",
  cost_records: "Náklady (ledger)",
};

export const FINANCE_ENTITY_KIND_LABELS: Record<FinanceEntityKind, string> = {
  hosting: "Hosting",
  project: "Projekty",
  task: "Úlohy",
  marketing: "Marketing",
  rental: "Prenájmy",
  other: "Ostatné",
};

export type EntityPaymentBucket = { amount: number; count: number };
export type EntityPaymentTotals = Record<FinanceEntityKind, EntityPaymentBucket>;

const EMPTY_BUCKET = (): EntityPaymentBucket => ({ amount: 0, count: 0 });

export function emptyEntityPaymentTotals(): EntityPaymentTotals {
  return {
    hosting: EMPTY_BUCKET(),
    project: EMPTY_BUCKET(),
    task: EMPTY_BUCKET(),
    marketing: EMPTY_BUCKET(),
    rental: EMPTY_BUCKET(),
    other: EMPTY_BUCKET(),
  };
}

export function financeSourceTableLabel(table: string | null | undefined): string | null {
  if (!table) return null;
  return FINANCE_SOURCE_TABLE_LABELS[table] ?? table;
}

export function resolveTaskPaymentSublabel(sourceId: string | null | undefined): string | null {
  if (!sourceId) return null;
  if (sourceId.endsWith(":deposit")) return "Záloha";
  if (sourceId.endsWith(":full")) return "Doplatok / úhrada";
  return null;
}

export function resolveFinanceOriginKind(
  sourceTable: string | null | undefined,
  _sourceId?: string | null,
): FinanceOriginKind {
  switch (sourceTable) {
    case "hosting_records":
      return "hosting";
    case "project_notes":
      return "project";
    case "tasks":
      return "task";
    case "marketing_records":
      return "marketing";
    case "rental_payments":
      return "rental";
    case "commissions":
      return "commission";
    case "expenses":
      return "expense";
    case null:
    case undefined:
    case "":
      return "unlinked";
    default:
      return "other";
  }
}

export function originKindToEntityKind(kind: FinanceOriginKind): FinanceEntityKind {
  if (
    kind === "hosting" ||
    kind === "project" ||
    kind === "task" ||
    kind === "marketing" ||
    kind === "rental"
  ) {
    return kind;
  }
  return "other";
}

export type PaymentRecordOriginView = {
  kind: FinanceOriginKind;
  entityKind: FinanceEntityKind;
  entityLabel: string | null;
  sublabel: string | null;
  detail: string;
};

export function resolvePaymentRecordOrigin(row: {
  source_table?: string | null;
  source_id?: string | null;
  note?: string | null;
}): PaymentRecordOriginView {
  const kind = resolveFinanceOriginKind(row.source_table, row.source_id);
  const entityKind = originKindToEntityKind(kind);
  const entityLabel =
    kind === "unlinked" || kind === "other"
      ? null
      : (FINANCE_ENTITY_KIND_LABELS[entityKind] ?? financeSourceTableLabel(row.source_table));
  const sublabel = row.source_table === "tasks" ? resolveTaskPaymentSublabel(row.source_id) : null;

  const parts: string[] = [];
  if (entityLabel) parts.push(entityLabel);
  if (sublabel) parts.push(sublabel);
  if (parts.length === 0 && row.source_table) {
    parts.push(financeSourceTableLabel(row.source_table) ?? row.source_table);
  }
  if (parts.length === 0) parts.push("Bez prepojenia na entitu");

  return {
    kind,
    entityKind,
    entityLabel,
    sublabel,
    detail: parts.join(" · "),
  };
}

export function resolvePayoutRecordOrigin(row: {
  source_table?: string | null;
  source_id?: string | null;
}): { label: string; detail: string } {
  const label = financeSourceTableLabel(row.source_table) ?? "Bez prepojenia";
  const kind = resolveFinanceOriginKind(row.source_table, row.source_id);
  if (kind === "commission") return { label: "Provízie", detail: "Provízie · workflow → payout fact" };
  return { label, detail: label };
}

/** Confirmed payment_fact rows grouped by entity kind — excludes legacy_import and workflow. */
export function aggregateConfirmedEntityPayments(
  paymentRecords: Array<{
    source_table?: string | null;
    source_id?: string | null;
    rental_website_id?: string | null;
    amount: number;
    truth_level: string;
  }>,
  parents?: CommissionParentContext,
): EntityPaymentTotals {
  const totals = emptyEntityPaymentTotals();
  for (const row of paymentRecords) {
    if (row.truth_level !== "payment_fact") continue;
    if (parents && !paymentRecordHasLiveDealParent(row, parents)) continue;
    const { entityKind } = resolvePaymentRecordOrigin(row);
    totals[entityKind].amount += Number(row.amount || 0);
    totals[entityKind].count += 1;
  }
  return totals;
}

export function formatReconciliationSourceHint(
  sourceTable?: string | null,
  sourceId?: string | null,
): string | null {
  if (!sourceTable) return null;
  const label = financeSourceTableLabel(sourceTable) ?? sourceTable;
  if (sourceTable === "tasks" && sourceId) {
    const sub = resolveTaskPaymentSublabel(sourceId);
    return sub ? `${label} · ${sub}` : label;
  }
  return label;
}
