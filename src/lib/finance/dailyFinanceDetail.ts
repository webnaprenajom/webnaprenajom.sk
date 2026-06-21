/**
 * Normalized read-side rows for daily Finance summary drilldown.
 * ponytail: reuses implementerCommissionView + cost_records; no new truth model.
 */
import type { CommissionRow } from "@/lib/commissionSource";
import {
  buildImplementerCommissionViewRows,
  summarizeImplementerCommissionViewRows,
  type ImplementerCommissionViewRow,
} from "@/lib/finance/implementerCommissionView";
import type { PayoutRecordLike } from "@/lib/finance/commissionPayoutStatus";
import {
  DEAL_PAYOUT_STATUS_LABELS,
  type DealPayoutStatus,
} from "@/lib/finance/rentalCommissionDeal";
import {
  financeSourceTableLabel,
  resolveFinanceOriginKind,
  type FinanceOriginKind,
} from "@/lib/finance/financeSourceLabels";
import { normalizeRentalImplementers } from "@/lib/rentalImplementers";
import {
  classifyRentalCommissionLiveState,
  rentalCommissionSurfacesInProductUx,
  type CommissionParentContext,
} from "@/lib/finance/rentalCommissionEntitlement";

export type DailyFinanceDetailKind = "commission" | "cost";

export type DailyFinanceDetailRow = {
  id: string;
  kind: DailyFinanceDetailKind;
  sourceType: string;
  sourceLabel: string;
  sourceTitle: string;
  customerName: string | null;
  counterpartyName: string | null;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  occurredAt: string;
  linkedSourceTable: string | null;
  linkedSourceId: string | null;
  note: string | null;
  reference: string | null;
  truthLevel: string | null;
};

export type DailyFinanceCommissionSummary = {
  rowCount: number;
  potential: number;
  paid: number;
  remaining: number;
};

export type DailyFinanceCostSummary = {
  rowCount: number;
  total: number;
  confirmed: number;
  legacy: number;
};

type CostRecordInput = {
  id: string;
  amount: number | null;
  paid_at?: string | null;
  incurred_at?: string | null;
  category?: string | null;
  vendor?: string | null;
  client_name?: string | null;
  note?: string | null;
  reference?: string | null;
  truth_level?: string | null;
  source_table?: string | null;
  source_id?: string | null;
};

type BuildCommissionOpts = {
  year: number;
  commissions: CommissionRow[];
  payoutRecords: PayoutRecordLike[];
  websites: Array<{
    id: string;
    name?: string | null;
    client_name?: string | null;
    monthly_price?: number | null;
    implementers?: unknown;
  }>;
  payments: Array<{
    website_id: string;
    year: number;
    month: number;
    status?: string | null;
    paid?: boolean | null;
    custom_price?: number | null;
    amount?: number | null;
  }>;
  /** null = all implementers (owner scope). */
  scopeImplementer: string | null;
  parents?: CommissionParentContext;
};

function costRecordDate(cr: CostRecordInput): string {
  return (cr.paid_at ?? cr.incurred_at ?? "").slice(0, 10);
}

function inYear(iso: string | null | undefined, year: number): boolean {
  return Boolean(iso && iso.startsWith(String(year)));
}

export function collectImplementerNamesForYear(opts: BuildCommissionOpts): string[] {
  const yearStr = String(opts.year);
  const names = new Set<string>();

  for (const c of opts.commissions) {
    if (!(c.date || "").startsWith(yearStr)) continue;
    const impl = (c.implementer || "").trim();
    if (!impl) continue;
    if (opts.scopeImplementer && impl !== opts.scopeImplementer) continue;
    const liveState = classifyRentalCommissionLiveState(
      c,
      opts.websites,
      opts.payoutRecords,
      opts.parents,
    );
    if (!rentalCommissionSurfacesInProductUx(liveState)) continue;
    names.add(impl);
  }

  for (const w of opts.websites) {
    for (const impl of normalizeRentalImplementers(w.implementers)) {
      const name = impl.name.trim();
      if (!name) continue;
      if (opts.scopeImplementer && name !== opts.scopeImplementer) continue;
      names.add(name);
    }
  }

  return [...names].sort((a, b) => a.localeCompare(b, "sk"));
}

function commissionViewToDailyRow(
  row: ImplementerCommissionViewRow,
  implementer: string,
): DailyFinanceDetailRow {
  const truthLevel =
    row.paidAmount > 0
      ? "payout_fact"
      : row.workflowPaidUnaudited
        ? "workflow_only"
        : null;

  return {
    id: `${implementer}:${row.id}`,
    kind: "commission",
    sourceType: row.sourceType,
    sourceLabel: row.sourceLabel,
    sourceTitle: row.sourceTitle,
    customerName: row.customerName,
    counterpartyName: implementer,
    amount: row.potentialAmount,
    paidAmount: row.paidAmount,
    remainingAmount: row.remainingAmount,
    status: DEAL_PAYOUT_STATUS_LABELS[row.payoutStatus],
    occurredAt: row.sortDate,
    linkedSourceTable: row.linkedSourceTable,
    linkedSourceId: row.linkedSourceId,
    note: row.note,
    reference: row.paymentForm,
    truthLevel,
  };
}

/** Org- or implementer-scoped commission drilldown rows — canonical deal model, deduped by row id. */
export function buildDailyCommissionDetailRows(opts: BuildCommissionOpts): DailyFinanceDetailRow[] {
  const byId = new Map<string, DailyFinanceDetailRow>();

  for (const implementer of collectImplementerNamesForYear(opts)) {
    const viewRows = buildImplementerCommissionViewRows({
      implementer,
      year: opts.year,
      commissions: opts.commissions,
      payoutRecords: opts.payoutRecords,
      websites: opts.websites,
      payments: opts.payments,
      parents: opts.parents,
    });
    for (const row of viewRows) {
      const daily = commissionViewToDailyRow(row, implementer);
      byId.set(daily.id, daily);
    }
  }

  return [...byId.values()].sort((a, b) => {
    const dt = b.occurredAt.localeCompare(a.occurredAt);
    return dt !== 0 ? dt : a.id.localeCompare(b.id);
  });
}

function originKindToSourceType(kind: FinanceOriginKind): string {
  if (kind === "commission" || kind === "expense" || kind === "unlinked" || kind === "other") {
    return kind;
  }
  return kind;
}

export function buildDailyCostDetailRows(
  costRecords: CostRecordInput[],
  year: number,
): DailyFinanceDetailRow[] {
  return costRecords
    .filter((cr) => inYear(costRecordDate(cr), year))
    .map((cr): DailyFinanceDetailRow => {
      const originKind = resolveFinanceOriginKind(cr.source_table, cr.source_id);
      const sourceType = originKindToSourceType(originKind);
      const linkedLabel = financeSourceTableLabel(cr.source_table);
      const sourceLabel = linkedLabel ?? (cr.category ? "Kategória" : "Manuálny záznam");
      const sourceTitle =
        cr.category && cr.vendor
          ? `${cr.category} · ${cr.vendor}`
          : cr.category ?? cr.vendor ?? "Náklad";
      const amount = Number(cr.amount || 0);
      const truth = cr.truth_level ?? "cost_fact";

      return {
        id: cr.id,
        kind: "cost",
        sourceType,
        sourceLabel,
        sourceTitle,
        customerName: cr.client_name ?? null,
        counterpartyName: cr.vendor ?? cr.category ?? null,
        amount,
        paidAmount: amount,
        remainingAmount: 0,
        status: truth === "legacy_import" ? "Legacy import" : "Potvrdený náklad",
        occurredAt: costRecordDate(cr),
        linkedSourceTable: cr.source_table ?? null,
        linkedSourceId: cr.source_id ?? null,
        note: cr.note ?? null,
        reference: cr.reference ?? null,
        truthLevel: truth,
      };
    })
    .sort((a, b) => {
      const dt = b.occurredAt.localeCompare(a.occurredAt);
      return dt !== 0 ? dt : a.id.localeCompare(b.id);
    });
}

export function summarizeDailyCommissionRows(
  rows: DailyFinanceDetailRow[],
): DailyFinanceCommissionSummary {
  const viewShaped: ImplementerCommissionViewRow[] = rows.map((r) => ({
    id: r.id,
    sourceType: r.sourceType as ImplementerCommissionViewRow["sourceType"],
    sourceLabel: r.sourceLabel,
    sourceTitle: r.sourceTitle,
    customerName: r.customerName,
    potentialAmount: r.amount,
    paidAmount: r.paidAmount,
    remainingAmount: r.remainingAmount,
    payoutStatus: inferPayoutStatus(r.amount, r.paidAmount),
    payoutHistory: [],
    workflowPaidUnaudited: r.truthLevel === "workflow_only",
    linkedSourceId: r.linkedSourceId,
    linkedSourceTable: r.linkedSourceTable,
    commissionId: r.linkedSourceId,
    sortDate: r.occurredAt,
    note: r.note,
    paymentForm: r.reference,
  }));

  const s = summarizeImplementerCommissionViewRows(viewShaped);
  return {
    rowCount: s.count,
    potential: s.potential,
    paid: s.paid,
    remaining: s.remaining,
  };
}

function inferPayoutStatus(potential: number, paid: number): DealPayoutStatus {
  if (paid <= 0) return "unpaid";
  if (paid > potential) return "overpaid";
  if (paid < potential) return "partially_paid";
  return "paid";
}

export function summarizeDailyCostRows(rows: DailyFinanceDetailRow[]): DailyFinanceCostSummary {
  let total = 0;
  let confirmed = 0;
  let legacy = 0;
  for (const r of rows) {
    total += r.amount;
    if (r.truthLevel === "legacy_import") legacy += r.amount;
    else confirmed += r.amount;
  }
  return { rowCount: rows.length, total, confirmed, legacy };
}

/** Group detail rows by sourceLabel for compact UI sections. */
export function groupDailyFinanceDetailRows(
  rows: DailyFinanceDetailRow[],
): Array<{ sourceLabel: string; rows: DailyFinanceDetailRow[] }> {
  const map = new Map<string, DailyFinanceDetailRow[]>();
  for (const row of rows) {
    const key = row.sourceLabel || "Ostatné";
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "sk"))
    .map(([sourceLabel, groupRows]) => ({ sourceLabel, rows: groupRows }));
}
