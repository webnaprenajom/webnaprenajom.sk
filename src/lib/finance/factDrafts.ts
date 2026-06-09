import { supabase } from "@/integrations/supabase/client";
import type { ReconciliationIssue } from "./types";

export type FactKind = "payment" | "payout" | "cost";

export interface FactDraft {
  kind: FactKind;
  amount: string;
  paid_at: string;
  incurred_at?: string;
  method?: string;
  reference?: string;
  customer_email?: string;
  client_name?: string;
  implementer?: string;
  category?: string;
  vendor?: string;
  note?: string;
  source_table?: string | null;
  source_id?: string | null;
}

export interface FinanceRawContext {
  commissions: any[];
  expenses: any[];
  websites: any[];
  payments: any[];
  paymentRecords: any[];
  payoutRecords: any[];
  costRecords: any[];
}

const todayLocal = () => new Date().toISOString().slice(0, 16);

export const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return todayLocal();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return todayLocal();
  return d.toISOString().slice(0, 16);
};

export const fromLocalInput = (local: string) => {
  if (!local) return new Date().toISOString();
  return new Date(local).toISOString();
};

function sourceKey(table: string | null | undefined, id: string | null | undefined): string | null {
  if (!table || !id) return null;
  return `${table}:${id}`;
}

export function hasSourceLinkedRecord(
  ctx: FinanceRawContext,
  table: string,
  id: string,
): boolean {
  const key = sourceKey(table, id);
  if (!key) return false;
  const sets = [
    ctx.paymentRecords.map((r) => sourceKey(r.source_table, r.source_id)),
    ctx.payoutRecords.map((r) => sourceKey(r.source_table, r.source_id)),
    ctx.costRecords.map((r) => sourceKey(r.source_table, r.source_id)),
  ];
  return sets.some((s) => s.includes(key));
}

/** Hide promote if a confirmed fact likely already exists for this legacy row. */
export function hasPromotedFactForLegacy(
  ctx: FinanceRawContext,
  kind: FactKind,
  legacyRow: any,
): boolean {
  const amount = Number(legacyRow.amount || 0);
  const date = (legacyRow.paid_at ?? legacyRow.incurred_at ?? "").slice(0, 10);
  if (kind === "payment") {
    return ctx.paymentRecords.some(
      (r) =>
        r.truth_level === "payment_fact" &&
        Number(r.amount) === amount &&
        r.paid_at?.slice(0, 10) === date &&
        (r.client_name === legacyRow.client_name || r.customer_email === legacyRow.customer_email),
    );
  }
  if (kind === "payout") {
    return ctx.payoutRecords.some(
      (r) =>
        r.truth_level === "payout_fact" &&
        Number(r.amount) === amount &&
        r.paid_at?.slice(0, 10) === date &&
        r.implementer === legacyRow.implementer,
    );
  }
  return ctx.costRecords.some(
    (r) =>
      r.truth_level === "cost_fact" &&
      Number(r.amount) === amount &&
      (r.paid_at ?? r.incurred_at)?.slice(0, 10) === date &&
      (r.category === legacyRow.category || r.vendor === legacyRow.vendor),
  );
}

export function kindFromRecordTable(table: string | undefined): FactKind | null {
  if (table === "payment_records") return "payment";
  if (table === "payout_records") return "payout";
  if (table === "cost_records") return "cost";
  return null;
}

export function prefillFromLegacyRecord(kind: FactKind, row: any): FactDraft {
  const base: FactDraft = {
    kind,
    amount: String(row.amount ?? ""),
    paid_at: toLocalInput(row.paid_at),
    note: row.note ? `${row.note} · promoted from legacy ${row.id?.slice(0, 8)}` : `Promoted from legacy ${row.id?.slice(0, 8)}`,
    source_table: null,
    source_id: null,
  };
  if (kind === "payment") {
    return {
      ...base,
      method: row.method ?? "",
      reference: row.reference ?? "",
      customer_email: row.customer_email ?? "",
      client_name: row.client_name ?? "",
    };
  }
  if (kind === "payout") {
    return {
      ...base,
      implementer: row.implementer ?? "",
      reference: row.reference ?? "",
    };
  }
  return {
    ...base,
    incurred_at: toLocalInput(row.incurred_at ?? row.paid_at),
    category: row.category ?? "",
    vendor: row.vendor ?? "",
    reference: row.reference ?? "",
  };
}

export function prefillFromReconciliationIssue(
  issue: ReconciliationIssue,
  ctx: FinanceRawContext,
): FactDraft | null {
  if (issue.kind === "workflow_incoming" && issue.sourceId) {
    const p = ctx.payments.find((r) => r.id === issue.sourceId);
    const w = p ? ctx.websites.find((site) => site.id === p.website_id) : null;
    if (hasSourceLinkedRecord(ctx, "rental_payments", issue.sourceId)) return null;
    return {
      kind: "payment",
      amount: String(issue.amount ?? p?.amount ?? ""),
      paid_at: toLocalInput(p?.paid_at ?? new Date().toISOString()),
      client_name: w?.client_name ?? "",
      note: w ? `Prenájom ${w.name} · ${p?.month}/${p?.year}` : issue.title,
      source_table: "rental_payments",
      source_id: issue.sourceId,
    };
  }

  if (issue.kind === "workflow_outgoing_commission" && issue.sourceId) {
    const c = ctx.commissions.find((r) => r.id === issue.sourceId);
    if (!c || hasSourceLinkedRecord(ctx, "commissions", issue.sourceId)) return null;
    return {
      kind: "payout",
      amount: String(c.amount ?? ""),
      paid_at: toLocalInput(c.date ? `${c.date}T12:00:00` : undefined),
      implementer: c.implementer ?? "",
      note: c.note ?? c.title,
      source_table: "commissions",
      source_id: issue.sourceId,
    };
  }

  if (issue.kind === "workflow_outgoing_expense" && issue.sourceId) {
    const e = ctx.expenses.find((r) => r.id === issue.sourceId);
    if (!e || hasSourceLinkedRecord(ctx, "expenses", issue.sourceId)) return null;
    return {
      kind: "cost",
      amount: String(e.amount ?? ""),
      paid_at: toLocalInput(e.date ? `${e.date}T12:00:00` : undefined),
      incurred_at: toLocalInput(e.date ? `${e.date}T12:00:00` : undefined),
      category: e.category ?? "",
      note: e.note ?? e.title,
      source_table: "expenses",
      source_id: issue.sourceId,
    };
  }

  if (
    (issue.kind === "legacy_no_reference" || issue.kind === "legacy_imprecise_paid_at") &&
    issue.recordId &&
    issue.sourceTable
  ) {
    const kind = kindFromRecordTable(issue.sourceTable);
    if (!kind) return null;
    const row =
      kind === "payment"
        ? ctx.paymentRecords.find((r) => r.id === issue.recordId)
        : kind === "payout"
          ? ctx.payoutRecords.find((r) => r.id === issue.recordId)
          : ctx.costRecords.find((r) => r.id === issue.recordId);
    if (!row || row.truth_level !== "legacy_import") return null;
    if (hasPromotedFactForLegacy(ctx, kind, row)) return null;
    return prefillFromLegacyRecord(kind, row);
  }

  return null;
}

export function prefillFromRentalPayment(
  payment: any,
  website: any,
  ctx: FinanceRawContext,
): FactDraft | null {
  if (hasSourceLinkedRecord(ctx, "rental_payments", payment.id)) return null;
  return {
    kind: "payment",
    amount: String(payment.amount ?? ""),
    paid_at: toLocalInput(payment.paid_at),
    client_name: website?.client_name ?? "",
    note: website ? `Prenájom ${website.name} · ${payment.month}/${payment.year}` : "",
    source_table: "rental_payments",
    source_id: payment.id,
  };
}

export function prefillFromCommission(commission: any, ctx: FinanceRawContext): FactDraft | null {
  if (hasSourceLinkedRecord(ctx, "commissions", commission.id)) return null;
  return {
    kind: "payout",
    amount: String(commission.amount ?? ""),
    paid_at: toLocalInput(commission.date ? `${commission.date}T12:00:00` : undefined),
    implementer: commission.implementer ?? "",
    note: commission.note ?? commission.title,
    source_table: "commissions",
    source_id: commission.id,
  };
}

export function prefillFromExpense(expense: any, ctx: FinanceRawContext): FactDraft | null {
  if (hasSourceLinkedRecord(ctx, "expenses", expense.id)) return null;
  return {
    kind: "cost",
    amount: String(expense.amount ?? ""),
    paid_at: toLocalInput(expense.date ? `${expense.date}T12:00:00` : undefined),
    incurred_at: toLocalInput(expense.date ? `${expense.date}T12:00:00` : undefined),
    category: expense.category ?? "",
    note: expense.note ?? expense.title,
    source_table: "expenses",
    source_id: expense.id,
  };
}

/** Opt-in payment fact from hosting record — no auto-sync. */
export function prefillFromHosting(
  hosting: {
    id: string;
    client_name: string | null;
    customer_email: string | null;
    monthly_price: number | null;
    yearly_price: number | null;
    provider: string | null;
    note: string | null;
  },
  ctx: FinanceRawContext,
): FactDraft | null {
  if (hasSourceLinkedRecord(ctx, "hosting_records", hosting.id)) return null;
  const amount = hosting.monthly_price ?? hosting.yearly_price;
  if (amount == null || Number(amount) <= 0) return null;
  return {
    kind: "payment",
    amount: String(amount),
    paid_at: todayLocal(),
    customer_email: hosting.customer_email ?? "",
    client_name: hosting.client_name ?? "",
    note: hosting.note ?? `Hosting ${hosting.provider ?? ""}`.trim(),
    source_table: "hosting_records",
    source_id: hosting.id,
  };
}

export function getIssueActionLabel(issue: ReconciliationIssue): string | null {
  switch (issue.kind) {
    case "workflow_incoming":
      return "Vytvoriť confirmed payment";
    case "workflow_outgoing_commission":
      return "Vytvoriť confirmed payout";
    case "workflow_outgoing_expense":
      return "Vytvoriť confirmed cost";
    case "legacy_no_reference":
    case "legacy_imprecise_paid_at":
      return "Potvrdiť ako fact";
    default:
      return null;
  }
}

export function isIssueActionable(issue: ReconciliationIssue, ctx: FinanceRawContext): boolean {
  if (issue.kind === "potential_duplicate" || issue.kind === "missing_counterparty") {
    return false;
  }
  return prefillFromReconciliationIssue(issue, ctx) != null;
}

export async function saveFactDraft(draft: FactDraft): Promise<void> {
  const amount = Number(draft.amount);
  if (!amount || amount <= 0) throw new Error("Neplatná suma");

  if (draft.kind === "payment") {
    const payload: Record<string, unknown> = {
      amount,
      paid_at: fromLocalInput(draft.paid_at),
      method: draft.method || null,
      reference: draft.reference || null,
      customer_email: draft.customer_email || null,
      client_name: draft.client_name || null,
      note: draft.note || null,
      currency: "EUR",
      truth_level: "payment_fact",
    };
    if (draft.source_table && draft.source_id) {
      payload.source_table = draft.source_table;
      payload.source_id = draft.source_id;
    }
    const { error } = await supabase.from("payment_records").insert(payload);
    if (error) throw error;
    return;
  }

  if (draft.kind === "payout") {
    const payload: Record<string, unknown> = {
      amount,
      paid_at: fromLocalInput(draft.paid_at),
      implementer: draft.implementer || null,
      reference: draft.reference || null,
      note: draft.note || null,
      currency: "EUR",
      truth_level: "payout_fact",
    };
    if (draft.source_table && draft.source_id) {
      payload.source_table = draft.source_table;
      payload.source_id = draft.source_id;
    }
    const { error } = await supabase.from("payout_records").insert(payload);
    if (error) throw error;
    return;
  }

  const paidAt = draft.paid_at ? fromLocalInput(draft.paid_at) : null;
  const incurredAt = draft.incurred_at ? fromLocalInput(draft.incurred_at) : null;
  if (!paidAt && !incurredAt) throw new Error("Zadajte paid_at alebo incurred_at");

  const payload: Record<string, unknown> = {
    amount,
    paid_at: paidAt,
    incurred_at: incurredAt,
    category: draft.category || null,
    vendor: draft.vendor || null,
    reference: draft.reference || null,
    note: draft.note || null,
    currency: "EUR",
    truth_level: "cost_fact",
  };
  if (draft.source_table && draft.source_id) {
    payload.source_table = draft.source_table;
    payload.source_id = draft.source_id;
  }
  const { error } = await supabase.from("cost_records").insert(payload);
  if (error) throw error;
}
