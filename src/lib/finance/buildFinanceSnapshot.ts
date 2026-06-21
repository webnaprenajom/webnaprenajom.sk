/** CRITICAL: Plan Mode only — see GOVERNANCE.md. Ledger truth + reconciliation source of truth. */
import type { FinanceLedgerRow, FinanceSnapshot, FinanceTruthLevel } from "./types";
import { fmtEur, formatAmount1Decimal } from "@/lib/money/formatMoney";
import { buildReconciliation } from "./buildReconciliation";
import type {
  HostingReconRow,
  MarketingReconRow,
  ProjectReconRow,
  TaskReconRow,
} from "./reconciliationEntityRows";
import {
  FINANCE_TRUTH_DISCLAIMER,
  COMMISSION_STATUS_LABELS,
  EXPENSE_STATUS_LABELS,
  RENTAL_MONTH_STATUS_LABELS,
  TRUTH_LEVEL_LABELS,
} from "./labels";
import {
  aggregateConfirmedEntityPayments,
  resolvePaymentRecordOrigin,
  resolvePayoutRecordOrigin,
  financeSourceTableLabel,
} from "./financeSourceLabels";

type CommissionRow = {
  id: string;
  date: string;
  title: string;
  implementer: string;
  amount: number;
  payment_status: string;
  note: string | null;
};

type ExpenseRow = {
  id: string;
  date: string;
  title: string;
  category: string | null;
  amount: number;
  payment_status: string;
  note: string | null;
};

type RentalWebsiteRow = {
  id: string;
  name: string;
  client_name: string | null;
  monthly_price: number;
  credits_used: number;
  year: number;
};

type RentalPaymentRow = {
  id: string;
  website_id: string;
  year: number;
  month: number;
  amount: number;
  status: string;
  custom_price: number | null;
};

type PaymentRecordRow = {
  id: string;
  source_table: string | null;
  source_id: string | null;
  customer_email: string | null;
  client_name: string | null;
  rental_website_id: string | null;
  amount: number;
  currency: string;
  paid_at: string;
  method: string | null;
  reference: string | null;
  note: string | null;
  truth_level: string;
  imported_from: string | null;
};

type PayoutRecordRow = {
  id: string;
  source_table: string | null;
  source_id: string | null;
  implementer: string | null;
  amount: number;
  currency: string;
  paid_at: string;
  reference: string | null;
  note: string | null;
  truth_level: string;
  imported_from: string | null;
};

type CostRecordRow = {
  id: string;
  source_table: string | null;
  source_id: string | null;
  category: string | null;
  vendor: string | null;
  client_name: string | null;
  rental_website_id: string | null;
  amount: number;
  currency: string;
  paid_at: string | null;
  incurred_at: string | null;
  reference: string | null;
  note: string | null;
  truth_level: string;
  imported_from: string | null;
};

const CREDIT_COST = 30 / 100;

function sourceKey(table: string | null, id: string | null): string | null {
  if (!table || !id) return null;
  return `${table}:${id}`;
}

function paymentTruthLevel(raw: string): FinanceTruthLevel {
  return raw === "payment_fact" ? "payment_fact" : "legacy_import";
}

function payoutTruthLevel(raw: string): FinanceTruthLevel {
  return raw === "payout_fact" ? "payout_fact" : "legacy_import";
}

function costTruthLevel(raw: string): FinanceTruthLevel {
  return raw === "cost_fact" ? "cost_fact" : "legacy_import";
}

function costDate(cr: CostRecordRow): string {
  return (cr.paid_at ?? cr.incurred_at ?? "").slice(0, 10);
}

export function buildFinanceSnapshot(input: {
  commissions: CommissionRow[];
  expenses: ExpenseRow[];
  websites: RentalWebsiteRow[];
  payments: RentalPaymentRow[];
  paymentRecords?: PaymentRecordRow[];
  payoutRecords?: PayoutRecordRow[];
  costRecords?: CostRecordRow[];
  projects?: ProjectReconRow[];
  marketing?: MarketingReconRow[];
  tasks?: TaskReconRow[];
  hosting?: HostingReconRow[];
  filterYear?: number;
}): FinanceSnapshot {
  const {
    commissions,
    expenses,
    websites,
    payments,
    paymentRecords = [],
    payoutRecords = [],
    costRecords = [],
    projects = [],
    marketing = [],
    tasks = [],
    hosting = [],
    filterYear,
  } = input;
  const rows: FinanceLedgerRow[] = [];

  const paymentSources = new Set(
    paymentRecords
      .map((r) => sourceKey(r.source_table, r.source_id))
      .filter((k): k is string => k != null),
  );
  const payoutSources = new Set(
    payoutRecords
      .map((r) => sourceKey(r.source_table, r.source_id))
      .filter((k): k is string => k != null),
  );
  const costSources = new Set(
    costRecords
      .map((r) => sourceKey(r.source_table, r.source_id))
      .filter((k): k is string => k != null),
  );

  for (const pr of paymentRecords) {
    const tl = paymentTruthLevel(pr.truth_level);
    const origin = resolvePaymentRecordOrigin(pr);
    const client = pr.client_name ?? pr.customer_email;
    const title = origin.entityLabel
      ? `Platba · ${origin.detail}${client ? ` · ${client}` : ""}`
      : client
        ? `Platba · ${client}`
        : pr.reference
          ? `Platba · ${pr.reference}`
          : "Platba (payment_records)";
    rows.push({
      id: `payment-record-${pr.id}`,
      kind: "payment_in",
      date: pr.paid_at.slice(0, 10),
      title,
      amount: Number(pr.amount || 0),
      currency: "EUR",
      direction: "in",
      statusLabel: TRUTH_LEVEL_LABELS[tl] ?? tl,
      truthLevel: tl,
      sourceTable: "payment_records",
      sourceId: pr.id,
      category: "platba",
      counterparty: pr.client_name ?? pr.customer_email,
      note: pr.note,
      clientName: pr.client_name,
      implementer: null,
      year: null,
      month: null,
      linkedOriginTable: pr.source_table,
      linkedOriginId: pr.source_id,
      linkedOriginLabel: origin.entityLabel,
      linkedOriginSublabel: origin.sublabel,
    });
  }

  for (const po of payoutRecords) {
    const tl = payoutTruthLevel(po.truth_level);
    const origin = resolvePayoutRecordOrigin(po);
    rows.push({
      id: `payout-record-${po.id}`,
      kind: "payout_out",
      date: po.paid_at.slice(0, 10),
      title: po.implementer
        ? `Výplata · ${po.implementer}${po.source_table ? ` · ${origin.label}` : ""}`
        : `Výplata · ${origin.detail}`,
      amount: Number(po.amount || 0),
      currency: "EUR",
      direction: "out",
      statusLabel: TRUTH_LEVEL_LABELS[tl] ?? tl,
      truthLevel: tl,
      sourceTable: "payout_records",
      sourceId: po.id,
      category: "výplata",
      counterparty: po.implementer,
      note: po.note,
      clientName: null,
      implementer: po.implementer,
      year: null,
      month: null,
      linkedOriginTable: po.source_table,
      linkedOriginId: po.source_id,
      linkedOriginLabel: origin.label,
      linkedOriginSublabel: null,
    });
  }

  for (const cr of costRecords) {
    const tl = costTruthLevel(cr.truth_level);
    rows.push({
      id: `cost-record-${cr.id}`,
      kind: "cost_out",
      date: costDate(cr),
      title: cr.category
        ? `Náklad · ${cr.category}`
        : cr.vendor
          ? `Náklad · ${cr.vendor}`
          : "Náklad (cost_records)",
      amount: Number(cr.amount || 0),
      currency: "EUR",
      direction: "out",
      statusLabel: TRUTH_LEVEL_LABELS[tl] ?? tl,
      truthLevel: tl,
      sourceTable: "cost_records",
      sourceId: cr.id,
      category: cr.category,
      counterparty: cr.vendor,
      note: cr.note,
      clientName: cr.client_name,
      implementer: null,
      year: null,
      month: null,
    });
  }

  for (const c of commissions) {
    const hasPayoutFact = payoutSources.has(sourceKey("commissions", c.id) ?? "");
    rows.push({
      id: `commission-${c.id}`,
      kind: "commission",
      date: c.date,
      title: c.title,
      amount: Number(c.amount || 0),
      currency: "EUR",
      direction: "out",
      statusLabel:
        c.payment_status === "paid"
          ? hasPayoutFact
            ? `${COMMISSION_STATUS_LABELS.paid} · potvrdené v payout_records`
            : COMMISSION_STATUS_LABELS.paid
          : COMMISSION_STATUS_LABELS.unpaid,
      truthLevel: "workflow_only",
      sourceTable: "commissions",
      sourceId: c.id,
      category: "provízia",
      counterparty: c.implementer,
      note: c.note,
      clientName: null,
      implementer: c.implementer,
      year: null,
      month: null,
    });
  }

  for (const e of expenses) {
    const hasCostFact = costSources.has(sourceKey("expenses", e.id) ?? "");
    rows.push({
      id: `expense-${e.id}`,
      kind: "expense",
      date: e.date,
      title: e.title,
      amount: Number(e.amount || 0),
      currency: "EUR",
      direction: "out",
      statusLabel:
        e.payment_status === "paid"
          ? hasCostFact
            ? `${EXPENSE_STATUS_LABELS.paid} · potvrdené v cost_records`
            : EXPENSE_STATUS_LABELS.paid
          : EXPENSE_STATUS_LABELS.unpaid,
      truthLevel: "workflow_only",
      sourceTable: "expenses",
      sourceId: e.id,
      category: e.category,
      counterparty: null,
      note: e.note,
      clientName: null,
      implementer: null,
      year: null,
      month: null,
    });
  }

  const paymentMap = new Map<string, RentalPaymentRow>();
  payments.forEach((p) => paymentMap.set(`${p.website_id}-${p.year}-${p.month}`, p));

  const year = filterYear ?? new Date().getFullYear();
  let rentalMarkedInvoiced = 0;
  let rentalMarkedUnpaid = 0;
  let rentalPotential = 0;
  let rentalCreditsCostDerived = 0;
  let workflowOnlyIn = 0;

  for (const w of websites) {
    rentalCreditsCostDerived += (Number(w.credits_used) || 0) * CREDIT_COST;
    for (let m = 1; m <= 12; m++) {
      const p = paymentMap.get(`${w.id}-${year}-${m}`);
      const price = p?.custom_price != null ? Number(p.custom_price) : Number(w.monthly_price);
      const amt = Number(p?.amount ?? price);
      const st = p?.status || "none";
      rentalPotential += price;
      if (st === "invoice") rentalMarkedInvoiced += amt;
      else if (st === "unpaid") rentalMarkedUnpaid += amt;

      if (st === "paid") {
        const hasPaymentFact = p ? paymentSources.has(sourceKey("rental_payments", p.id) ?? "") : false;
        if (!hasPaymentFact) workflowOnlyIn += amt;
      }

      if (!p || st === "none") continue;

      const hasPaymentFact = paymentSources.has(sourceKey("rental_payments", p.id) ?? "");
      rows.push({
        id: `rental-${p.id}`,
        kind: "rental_receivable",
        date: `${year}-${String(m).padStart(2, "0")}-01`,
        title: `${w.name} · ${m}/${year}`,
        amount: amt,
        currency: "EUR",
        direction: "in",
        statusLabel:
          hasPaymentFact && st === "paid"
            ? `${RENTAL_MONTH_STATUS_LABELS.paid} · potvrdené v payment_records`
            : RENTAL_MONTH_STATUS_LABELS[st as keyof typeof RENTAL_MONTH_STATUS_LABELS] ?? st,
        truthLevel: "workflow_only",
        sourceTable: "rental_payments",
        sourceId: p.id,
        category: "prenájom",
        counterparty: w.client_name,
        note: null,
        clientName: w.client_name,
        implementer: null,
        year,
        month: m,
        linkedOriginTable: hasPaymentFact ? "rental_payments" : null,
        linkedOriginId: hasPaymentFact ? p.id : null,
        linkedOriginLabel: hasPaymentFact ? (financeSourceTableLabel("rental_payments") ?? "Prenájmy") : null,
        linkedOriginSublabel: null,
      });
    }

    if (w.credits_used > 0 && !costSources.has(sourceKey("rental_credits", `${w.id}:${year}`) ?? "")) {
      rows.push({
        id: `rental-credit-${w.id}-${year}`,
        kind: "rental_credit_cost",
        date: `${year}-12-31`,
        title: `AI kredity · ${w.name}`,
        amount: Number(w.credits_used) * CREDIT_COST,
        currency: "EUR",
        direction: "out",
        statusLabel: "Odvodený náklad (sync do expenses možný)",
        truthLevel: "derived",
        sourceTable: "rental_websites",
        sourceId: w.id,
        category: "AI kredity",
        counterparty: null,
        note: `credits_used=${w.credits_used}`,
        clientName: w.client_name,
        implementer: null,
        year,
        month: null,
      });
    }
  }

  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const paymentsConfirmed = paymentRecords
    .filter((r) => r.truth_level === "payment_fact")
    .reduce((s, r) => s + Number(r.amount || 0), 0);
  const paymentsLegacyImport = paymentRecords
    .filter((r) => r.truth_level === "legacy_import")
    .reduce((s, r) => s + Number(r.amount || 0), 0);
  const payoutsConfirmed = payoutRecords
    .filter((r) => r.truth_level === "payout_fact")
    .reduce((s, r) => s + Number(r.amount || 0), 0);
  const payoutsLegacyImport = payoutRecords
    .filter((r) => r.truth_level === "legacy_import")
    .reduce((s, r) => s + Number(r.amount || 0), 0);
  const costsConfirmed = costRecords
    .filter((r) => r.truth_level === "cost_fact")
    .reduce((s, r) => s + Number(r.amount || 0), 0);
  const costsLegacyImport = costRecords
    .filter((r) => r.truth_level === "legacy_import")
    .reduce((s, r) => s + Number(r.amount || 0), 0);

  const workflowOnlyOut =
    commissions
      .filter(
        (c) =>
          c.payment_status === "paid" &&
          !payoutSources.has(sourceKey("commissions", c.id) ?? ""),
      )
      .reduce((s, c) => s + Number(c.amount || 0), 0) +
    expenses
      .filter(
        (e) =>
          e.payment_status === "paid" &&
          !costSources.has(sourceKey("expenses", e.id) ?? ""),
      )
      .reduce((s, e) => s + Number(e.amount || 0), 0);

  const sources = ["commissions", "expenses", "rental_websites", "rental_payments"];
  if (paymentRecords.length > 0) sources.push("payment_records");
  if (payoutRecords.length > 0) sources.push("payout_records");
  if (costRecords.length > 0) sources.push("cost_records");

  const entityPaymentsConfirmed = aggregateConfirmedEntityPayments(paymentRecords);

  const reconciliation = buildReconciliation({
    commissions,
    expenses,
    websites,
    payments,
    paymentRecords,
    payoutRecords,
    costRecords,
    projects,
    marketing,
    tasks,
    hosting,
    filterYear: year,
  });

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      truthDisclaimer: FINANCE_TRUTH_DISCLAIMER,
      sources,
      paymentRecordCount: paymentRecords.length,
      payoutRecordCount: payoutRecords.length,
      costRecordCount: costRecords.length,
    },
    rows,
    totals: {
      paymentsConfirmed,
      paymentsLegacyImport,
      payoutsConfirmed,
      payoutsLegacyImport,
      costsConfirmed,
      costsLegacyImport,
      workflowOnlyIn,
      workflowOnlyOut,
      rentalMarkedInvoiced,
      rentalMarkedUnpaid,
      rentalPotential,
      rentalCreditsCostDerived,
      entityPaymentsConfirmed,
    },
    reconciliation,
  };
}

export function financeSnapshotToCsv(snapshot: FinanceSnapshot): string {
  const headers = [
    "kind",
    "date",
    "title",
    "direction",
    "amount_eur",
    "status_label",
    "truth_level",
    "source_table",
    "source_id",
    "category",
    "counterparty",
    "client_name",
    "implementer",
    "year",
    "month",
    "note",
  ];
  const lines = snapshot.rows.map((r) =>
    [
      r.kind,
      r.date,
      r.title,
      r.direction,formatAmount1Decimal(r.amount),
      r.statusLabel,
      r.truthLevel,
      r.sourceTable,
      r.sourceId,
      r.category ?? "",
      r.counterparty ?? "",
      r.clientName ?? "",
      r.implementer ?? "",
      r.year ?? "",
      r.month ?? "",
      (r.note ?? "").replace(/\n/g, " "),
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(","),
  );
  return ["\ufeff" + headers.join(","), ...lines].join("\n");
}

export function downloadFinanceCsv(snapshot: FinanceSnapshot, filenamePrefix = "finance-snapshot") {
  const csv = financeSnapshotToCsv(snapshot);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
