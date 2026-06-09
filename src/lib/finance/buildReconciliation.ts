import type {
  ReconciliationIssue,
  ReconciliationIssueKind,
  ReconciliationSummaryCounts,
} from "./types";
import { buildIssueKey } from "./issueKeys";

type CommissionRow = {
  id: string;
  title: string;
  implementer: string;
  amount: number;
  payment_status: string;
};

type ExpenseRow = {
  id: string;
  title: string;
  amount: number;
  payment_status: string;
};

type RentalWebsiteRow = {
  id: string;
  name: string;
  client_name: string | null;
  monthly_price: number;
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
  amount: number;
  paid_at: string;
  reference: string | null;
  truth_level: string;
  imported_from: string | null;
};

type PayoutRecordRow = {
  id: string;
  source_table: string | null;
  source_id: string | null;
  implementer: string | null;
  amount: number;
  paid_at: string;
  reference: string | null;
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
  amount: number;
  paid_at: string | null;
  incurred_at: string | null;
  reference: string | null;
  truth_level: string;
  imported_from: string | null;
};

function sourceKey(table: string | null, id: string | null): string | null {
  if (!table || !id) return null;
  return `${table}:${id}`;
}

function pushIssue(
  issues: ReconciliationIssue[],
  kind: ReconciliationIssueKind,
  title: string,
  detail: string,
  opts: Partial<ReconciliationIssue> = {},
) {
  const issue: ReconciliationIssue = {
    kind,
    severity: kind.startsWith("workflow") ? "warn" : "info",
    title,
    detail,
    ...opts,
  };
  issue.issueKey = buildIssueKey(issue);
  issues.push(issue);
}

function dateKey(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function findDuplicateGroups<T extends { id: string; amount: number }>(
  items: T[],
  keyFn: (item: T) => string,
): T[][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

export function buildReconciliation(input: {
  commissions: CommissionRow[];
  expenses: ExpenseRow[];
  websites: RentalWebsiteRow[];
  payments: RentalPaymentRow[];
  paymentRecords: PaymentRecordRow[];
  payoutRecords: PayoutRecordRow[];
  costRecords: CostRecordRow[];
  filterYear?: number;
}): { counts: ReconciliationSummaryCounts; issues: ReconciliationIssue[] } {
  const {
    commissions,
    expenses,
    websites,
    payments,
    paymentRecords,
    payoutRecords,
    costRecords,
    filterYear,
  } = input;
  const issues: ReconciliationIssue[] = [];
  const year = filterYear ?? new Date().getFullYear();

  const paymentSources = new Set(
    paymentRecords.map((r) => sourceKey(r.source_table, r.source_id)).filter(Boolean) as string[],
  );
  const payoutSources = new Set(
    payoutRecords.map((r) => sourceKey(r.source_table, r.source_id)).filter(Boolean) as string[],
  );
  const costSources = new Set(
    costRecords.map((r) => sourceKey(r.source_table, r.source_id)).filter(Boolean) as string[],
  );

  const websiteMap = new Map(websites.map((w) => [w.id, w]));
  const paymentMap = new Map<string, RentalPaymentRow>();
  payments.forEach((p) => paymentMap.set(`${p.website_id}-${p.year}-${p.month}`, p));

  for (const w of websites) {
    for (let m = 1; m <= 12; m++) {
      const p = paymentMap.get(`${w.id}-${year}-${m}`);
      if (!p || p.status !== "paid") continue;
      if (paymentSources.has(sourceKey("rental_payments", p.id) ?? "")) continue;
      const price = p.custom_price != null ? Number(p.custom_price) : Number(w.monthly_price);
      const amt = Number(p.amount ?? price);
      pushIssue(
        issues,
        "workflow_incoming",
        `${w.name} · ${m}/${year}`,
        "Prenájom označ. uhradený bez záznamu v payment_records",
        { amount: amt, sourceTable: "rental_payments", sourceId: p.id },
      );
    }
  }

  for (const c of commissions) {
    if (c.payment_status !== "paid") continue;
    if (payoutSources.has(sourceKey("commissions", c.id) ?? "")) continue;
    pushIssue(
      issues,
      "workflow_outgoing_commission",
      c.title,
      `Provízia označ. vyplatená (${c.implementer}) bez payout_records`,
      { amount: Number(c.amount || 0), sourceTable: "commissions", sourceId: c.id },
    );
  }

  for (const e of expenses) {
    if (e.payment_status !== "paid") continue;
    if (costSources.has(sourceKey("expenses", e.id) ?? "")) continue;
    pushIssue(
      issues,
      "workflow_outgoing_expense",
      e.title,
      "Náklad označ. uhradený bez cost_records",
      { amount: Number(e.amount || 0), sourceTable: "expenses", sourceId: e.id },
    );
  }

  for (const r of paymentRecords) {
    if (r.truth_level === "legacy_import" && !r.reference) {
      pushIssue(
        issues,
        "legacy_no_reference",
        `Platba ${Number(r.amount).toFixed(2)} €`,
        r.client_name ?? r.customer_email ?? "Bez klienta",
        { amount: Number(r.amount), recordId: r.id, sourceTable: "payment_records" },
      );
    }
    if (r.truth_level === "legacy_import" && r.imported_from) {
      pushIssue(
        issues,
        "legacy_imprecise_paid_at",
        `Platba ${dateKey(r.paid_at)}`,
        `Odhadovaný dátum z ${r.imported_from}`,
        { amount: Number(r.amount), recordId: r.id, sourceTable: "payment_records" },
      );
    }
    if (!r.client_name && !r.customer_email) {
      pushIssue(
        issues,
        "missing_counterparty",
        "Platba bez klienta",
        `Suma ${Number(r.amount).toFixed(2)} € · ${dateKey(r.paid_at)}`,
        { amount: Number(r.amount), recordId: r.id, sourceTable: "payment_records" },
      );
    }
  }

  for (const r of payoutRecords) {
    if (r.truth_level === "legacy_import" && !r.reference) {
      pushIssue(
        issues,
        "legacy_no_reference",
        `Výplata ${Number(r.amount).toFixed(2)} €`,
        r.implementer ?? "Bez implementéra",
        { amount: Number(r.amount), recordId: r.id, sourceTable: "payout_records" },
      );
    }
    if (r.truth_level === "legacy_import" && r.imported_from) {
      pushIssue(
        issues,
        "legacy_imprecise_paid_at",
        `Výplata ${dateKey(r.paid_at)}`,
        `Odhadovaný dátum z ${r.imported_from}`,
        { amount: Number(r.amount), recordId: r.id, sourceTable: "payout_records" },
      );
    }
    if (!r.implementer) {
      pushIssue(
        issues,
        "missing_counterparty",
        "Výplata bez implementéra",
        `Suma ${Number(r.amount).toFixed(2)} € · ${dateKey(r.paid_at)}`,
        { amount: Number(r.amount), recordId: r.id, sourceTable: "payout_records" },
      );
    }
  }

  for (const r of costRecords) {
    if (r.truth_level === "legacy_import" && !r.reference) {
      pushIssue(
        issues,
        "legacy_no_reference",
        `Náklad ${Number(r.amount).toFixed(2)} €`,
        r.category ?? r.vendor ?? "Bez kategórie",
        { amount: Number(r.amount), recordId: r.id, sourceTable: "cost_records" },
      );
    }
    if (r.truth_level === "legacy_import" && r.imported_from) {
      pushIssue(
        issues,
        "legacy_imprecise_paid_at",
        `Náklad ${dateKey(r.paid_at ?? r.incurred_at)}`,
        `Odhadovaný dátum z ${r.imported_from}`,
        { amount: Number(r.amount), recordId: r.id, sourceTable: "cost_records" },
      );
    }
    if (!r.vendor && !r.category) {
      pushIssue(
        issues,
        "missing_counterparty",
        "Náklad bez kategórie/dodávateľa",
        `Suma ${Number(r.amount).toFixed(2)} €`,
        { amount: Number(r.amount), recordId: r.id, sourceTable: "cost_records" },
      );
    }
  }

  for (const group of findDuplicateGroups(paymentRecords, (r) =>
    `${dateKey(r.paid_at)}|${Number(r.amount).toFixed(2)}|${r.client_name ?? r.customer_email ?? ""}`,
  )) {
    pushIssue(
      issues,
      "potential_duplicate",
      `${group.length}× platba ${Number(group[0].amount).toFixed(2)} €`,
      `Rovnaký dátum/klient/suma (${dateKey(group[0].paid_at)})`,
      { amount: Number(group[0].amount), sourceTable: "payment_records" },
    );
  }

  for (const group of findDuplicateGroups(payoutRecords, (r) =>
    `${dateKey(r.paid_at)}|${Number(r.amount).toFixed(2)}|${r.implementer ?? ""}`,
  )) {
    pushIssue(
      issues,
      "potential_duplicate",
      `${group.length}× výplata ${Number(group[0].amount).toFixed(2)} €`,
      `Rovnaký dátum/implementér/suma (${dateKey(group[0].paid_at)})`,
      { amount: Number(group[0].amount), sourceTable: "payout_records" },
    );
  }

  for (const group of findDuplicateGroups(costRecords, (r) =>
    `${dateKey(r.paid_at ?? r.incurred_at)}|${Number(r.amount).toFixed(2)}|${r.vendor ?? r.category ?? ""}`,
  )) {
    pushIssue(
      issues,
      "potential_duplicate",
      `${group.length}× náklad ${Number(group[0].amount).toFixed(2)} €`,
      `Rovnaký dátum/kategória/suma`,
      { amount: Number(group[0].amount), sourceTable: "cost_records" },
    );
  }

  const counts: ReconciliationSummaryCounts = {
    workflowIncoming: issues.filter((i) => i.kind === "workflow_incoming").length,
    workflowOutgoing: issues.filter(
      (i) => i.kind === "workflow_outgoing_commission" || i.kind === "workflow_outgoing_expense",
    ).length,
    legacyNoReference: issues.filter((i) => i.kind === "legacy_no_reference").length,
    legacyImprecisePaidAt: issues.filter((i) => i.kind === "legacy_imprecise_paid_at").length,
    missingCounterparty: issues.filter((i) => i.kind === "missing_counterparty").length,
    potentialDuplicates: issues.filter((i) => i.kind === "potential_duplicate").length,
    totalIssues: issues.length,
  };

  return { counts, issues };
}
