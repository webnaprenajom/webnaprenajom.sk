import type {
  ReconciliationIssue,
  ReconciliationIssueKind,
  ReconciliationSummaryCounts,
} from "./types";
import type {
  HostingReconRow,
  MarketingReconRow,
  ProjectReconRow,
  TaskReconRow,
} from "./reconciliationEntityRows";
import { buildIssueKey } from "./issueKeys";
import { formatReconciliationSourceHint } from "./financeSourceLabels";
import { isLegacyTaskFinance } from "@/lib/tasks/taskFinanceModel";
import { sumConfirmedPaymentsForSource } from "./entityPaymentBridge";
import {
  reconciliationAgreedPriceDetail,
  resolvePaymentCompleteness,
} from "./paymentCompleteness";

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

function withSourceHint(
  detail: string,
  sourceTable?: string | null,
  sourceId?: string | null,
): string {
  const hint = formatReconciliationSourceHint(sourceTable, sourceId);
  return hint ? `${hint} · ${detail}` : detail;
}

function pushIssue(
  issues: ReconciliationIssue[],
  kind: ReconciliationIssueKind,
  title: string,
  detail: string,
  opts: Partial<ReconciliationIssue> = {},
) {
  const severity: ReconciliationIssue["severity"] =
    kind === "entity_payment_ahead_of_workflow"
      ? "info"
      : kind.startsWith("workflow") ||
          kind === "entity_missing_payment_fact" ||
          kind === "entity_partial_payment" ||
          kind.startsWith("task_missing")
        ? "warn"
        : "info";
  const issue: ReconciliationIssue = {
    kind,
    severity,
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

const TASK_DEPOSIT_STATUSES = new Set([
  "deposit_received",
  "send_final_invoice",
  "paid",
  "done",
]);
const TASK_PAID_STATUSES = new Set(["paid", "done"]);
const TASK_EARLY_STATUSES = new Set(["todo", "in_progress", "blocked"]);

export function hasConfirmedEntityPayment(
  records: PaymentRecordRow[],
  sourceTable: string,
  sourceId: string,
): boolean {
  return records.some(
    (r) =>
      r.source_table === sourceTable &&
      r.source_id === sourceId &&
      r.truth_level === "payment_fact",
  );
}

function hasLegacyEntityPayment(
  records: PaymentRecordRow[],
  sourceTable: string,
  sourceId: string,
): boolean {
  return records.some(
    (r) =>
      r.source_table === sourceTable &&
      r.source_id === sourceId &&
      r.truth_level === "legacy_import",
  );
}

function hasTaskDepositPaymentFact(records: PaymentRecordRow[], taskId: string): boolean {
  return (
    hasConfirmedEntityPayment(records, "tasks", `${taskId}:deposit`) ||
    hasConfirmedEntityPayment(records, "tasks", taskId)
  );
}

function hasTaskFullPaymentFact(records: PaymentRecordRow[], taskId: string): boolean {
  return hasConfirmedEntityPayment(records, "tasks", `${taskId}:full`);
}

function hasAnyTaskPaymentFact(records: PaymentRecordRow[], taskId: string): boolean {
  return (
    hasTaskDepositPaymentFact(records, taskId) || hasTaskFullPaymentFact(records, taskId)
  );
}

function taskFullAmountNeeded(
  task: TaskReconRow,
  records: PaymentRecordRow[],
): number {
  const total = Number(task.amount ?? 0);
  const dep = Number(task.deposit ?? 0);
  const depositLinked = hasTaskDepositPaymentFact(records, task.id);
  if (dep > 0 && depositLinked) {
    const remaining = total - dep;
    return remaining > 0 ? remaining : 0;
  }
  return total > 0 ? total : 0;
}

function pushAgreedPricePaymentGaps(
  issues: ReconciliationIssue[],
  paymentRecords: PaymentRecordRow[],
  entity: { id: string; title: string; agreed_fee?: number | null },
  sourceTable: "project_notes" | "marketing_records",
  entityLabel: string,
) {
  const fee = Number(entity.agreed_fee ?? 0);
  if (!fee || fee <= 0) return;
  const confirmed = sumConfirmedPaymentsForSource(paymentRecords, sourceTable, entity.id);
  const pc = resolvePaymentCompleteness(fee, confirmed);
  if (pc.status === "paid" || pc.status === "no_agreed_price") return;

  const detail = reconciliationAgreedPriceDetail(entityLabel, pc);
  if (!detail) return;

  if (pc.status === "unpaid") {
    pushIssue(issues, "entity_missing_payment_fact", entity.title, withSourceHint(detail, sourceTable, entity.id), {
      amount: fee,
      sourceTable,
      sourceId: entity.id,
    });
    return;
  }

  pushIssue(issues, "entity_partial_payment", entity.title, withSourceHint(detail, sourceTable, entity.id), {
    amount: pc.remaining,
    sourceTable,
    sourceId: entity.id,
  });
}

function reconcileEntityPaymentGaps(
  issues: ReconciliationIssue[],
  paymentRecords: PaymentRecordRow[],
  projects: ProjectReconRow[],
  marketing: MarketingReconRow[],
  tasks: TaskReconRow[],
  hosting: HostingReconRow[],
) {
  for (const p of projects) {
    if (p.status === "archived") continue;
    pushAgreedPricePaymentGaps(issues, paymentRecords, p, "project_notes", "Projekt");
  }

  for (const m of marketing) {
    if (m.status === "archived" || m.status === "paused") continue;
    pushAgreedPricePaymentGaps(issues, paymentRecords, m, "marketing_records", "Kampaň");
  }

  for (const h of hosting) {
    // ponytail: conservative — active + monthly_price + standalone (no rental bundle) + commissionable
    if (!h.active) continue;
    if (h.rental_website_id) continue;
    if (h.commissionable === false) continue;
    const price = Number(h.monthly_price ?? 0);
    if (!price || price <= 0) continue;
    const table = "hosting_records";
    if (
      hasConfirmedEntityPayment(paymentRecords, table, h.id) ||
      hasLegacyEntityPayment(paymentRecords, table, h.id)
    ) {
      continue;
    }
    const label = h.client_name ?? h.provider ?? "Hosting";
    pushIssue(
      issues,
      "entity_missing_payment_fact",
      label,
      withSourceHint(
        `Hosting má mesačnú cenu ${price.toFixed(2)} € bez potvrdené platby (payment_fact)`,
        table,
        h.id,
      ),
      { amount: price, sourceTable: table, sourceId: h.id },
    );
  }

  for (const t of tasks) {
    if (!isLegacyTaskFinance(t)) continue;

    const dep = Number(t.deposit ?? 0);
    if (
      dep > 0 &&
      TASK_DEPOSIT_STATUSES.has(t.status) &&
      !hasTaskDepositPaymentFact(paymentRecords, t.id) &&
      !hasLegacyEntityPayment(paymentRecords, "tasks", `${t.id}:deposit`) &&
      !hasLegacyEntityPayment(paymentRecords, "tasks", t.id)
    ) {
      pushIssue(
        issues,
        "task_missing_payment_deposit",
        t.title,
        withSourceHint(
          `Workflow (${t.status}) signalizuje zálohu ${dep.toFixed(2)} € bez payment_fact`,
          "tasks",
          `${t.id}:deposit`,
        ),
        { amount: dep, sourceTable: "tasks", sourceId: `${t.id}:deposit` },
      );
    }

    if (TASK_PAID_STATUSES.has(t.status)) {
      const needed = taskFullAmountNeeded(t, paymentRecords);
      const depositFact = hasTaskDepositPaymentFact(paymentRecords, t.id);
      if (
        needed > 0 &&
        !hasTaskFullPaymentFact(paymentRecords, t.id) &&
        !hasLegacyEntityPayment(paymentRecords, "tasks", `${t.id}:full`)
      ) {
        pushIssue(
          issues,
          "task_missing_payment_full",
          t.title,
          withSourceHint(
            depositFact
              ? `Workflow uhradené — chýba doplatok ${needed.toFixed(2)} € (payment_fact)`
              : `Workflow uhradené — chýba úhrada ${needed.toFixed(2)} € (payment_fact)`,
            "tasks",
            `${t.id}:full`,
          ),
          { amount: needed, sourceTable: "tasks", sourceId: `${t.id}:full` },
        );
      }
    }

    if (TASK_EARLY_STATUSES.has(t.status) && hasAnyTaskPaymentFact(paymentRecords, t.id)) {
      pushIssue(
        issues,
        "entity_payment_ahead_of_workflow",
        t.title,
        withSourceHint(
          `Potvrdená platba existuje, workflow stav je ešte „${t.status}"`,
          "tasks",
          t.id,
        ),
        { sourceTable: "tasks", sourceId: t.id },
      );
    }
  }
}

export function buildReconciliation(input: {
  commissions: CommissionRow[];
  expenses: ExpenseRow[];
  websites: RentalWebsiteRow[];
  payments: RentalPaymentRow[];
  paymentRecords: PaymentRecordRow[];
  payoutRecords: PayoutRecordRow[];
  costRecords: CostRecordRow[];
  projects?: ProjectReconRow[];
  marketing?: MarketingReconRow[];
  tasks?: TaskReconRow[];
  hosting?: HostingReconRow[];
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
    projects = [],
    marketing = [],
    tasks = [],
    hosting = [],
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
        withSourceHint(
          "Prenájom označ. uhradený bez záznamu v payment_records (workflow mirror)",
          "rental_payments",
          p.id,
        ),
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
      withSourceHint(
        `Provízia označ. vyplatená (${c.implementer}) bez payout_records (workflow mirror)`,
        "commissions",
        c.id,
      ),
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
      withSourceHint("Náklad označ. uhradený bez cost_records (workflow mirror)", "expenses", e.id),
      { amount: Number(e.amount || 0), sourceTable: "expenses", sourceId: e.id },
    );
  }

  reconcileEntityPaymentGaps(issues, paymentRecords, projects, marketing, tasks, hosting);

  for (const r of paymentRecords) {
    if (r.truth_level === "legacy_import" && !r.reference) {
      pushIssue(
        issues,
        "legacy_no_reference",
        `Platba ${Number(r.amount).toFixed(2)} €`,
        withSourceHint(
          r.client_name ?? r.customer_email ?? "Bez klienta",
          r.source_table,
          r.source_id,
        ),
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
        withSourceHint(
          `Suma ${Number(r.amount).toFixed(2)} € · ${dateKey(r.paid_at)}`,
          r.source_table,
          r.source_id,
        ),
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
    entityMissingPayment: issues.filter((i) => i.kind === "entity_missing_payment_fact").length,
    entityPartialPayment: issues.filter((i) => i.kind === "entity_partial_payment").length,
    taskPaymentGaps: issues.filter(
      (i) => i.kind === "task_missing_payment_deposit" || i.kind === "task_missing_payment_full",
    ).length,
    entityWorkflowMismatch: issues.filter(
      (i) => i.kind === "entity_payment_ahead_of_workflow",
    ).length,
    legacyNoReference: issues.filter((i) => i.kind === "legacy_no_reference").length,
    legacyImprecisePaidAt: issues.filter((i) => i.kind === "legacy_imprecise_paid_at").length,
    missingCounterparty: issues.filter((i) => i.kind === "missing_counterparty").length,
    potentialDuplicates: issues.filter((i) => i.kind === "potential_duplicate").length,
    totalIssues: issues.length,
  };

  return { counts, issues };
}
