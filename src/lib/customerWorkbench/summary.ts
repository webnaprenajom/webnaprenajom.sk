import { summarizeOpenTasks } from "@/lib/crmLookup/taskCustomerLink";
import { resolveProfitDisplayContext } from "@/lib/profit/profitContext";
import type {
  CommissionPayout,
  CustomerFinanceSummary,
  CustomerWorkbenchData,
  RecommendedAction,
  WorkbenchSummary,
} from "./types";

const todayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export function computeWorkbenchSummary(
  data: CustomerWorkbenchData,
  routeValue: string,
): WorkbenchSummary {
  const primaryLead = data.leads[0];
  const emailKey = data.canonicalCustomer?.email ?? (data.viewMode === "email" ? routeValue : "");
  const displayName =
    data.canonicalCustomer?.display_name ||
    primaryLead?.name ||
    data.signatures[0]?.client_name ||
    emailKey ||
    routeValue;
  const phone = primaryLead?.phone || null;

  let lifecycle: WorkbenchSummary["lifecycle"] = {
    label: "Bez histórie",
    tone: "bg-muted text-muted-foreground",
  };
  if (data.signatures.length > 0) {
    lifecycle = {
      label: "Aktívny zákazník",
      tone: "bg-green-500/15 text-green-700 dark:text-green-400",
    };
  } else if (data.leads.length > 0) {
    lifecycle = { label: "Lead v pipeline", tone: "bg-primary/15 text-primary" };
  }

  const openTasks = data.tasks.filter((t) => t.status !== "done");
  const activeProjects = data.notes.filter((n) => !["done", "archived"].includes(n.status));
  const activeHosting = data.hosting.filter((h) => h.active);
  const unpaidCommissions = data.commissions.filter((c) => c.payment_status !== "paid");
  const unlinkedInbound = data.commEvents.filter((e) => e.kind === "email_in" && !e.customer_id);

  const lastCommunicationAt =
    data.commEvents.length > 0
      ? data.commEvents.reduce((latest, e) =>
          new Date(e.occurred_at) > new Date(latest) ? e.occurred_at : latest,
        data.commEvents[0].occurred_at)
      : null;

  const overdueTasksCount = openTasks.filter((t) => {
    if (!t.due_date) return false;
    return new Date(t.due_date).getTime() < todayStart();
  }).length;

  const hasAnyData =
    data.leads.length +
      data.tasks.length +
      data.rentals.length +
      data.signatures.length +
      data.notes.length +
      data.hosting.length +
      data.wheels.length +
      data.designs.length +
      data.commEvents.length >
    0;

  const taskStats = summarizeOpenTasks(data.tasks);

  return {
    displayName,
    emailKey,
    phone,
    lifecycle,
    lastCommunicationAt,
    activeProjectsCount: activeProjects.length,
    activeRentalsCount: data.rentals.length,
    hostingCount: activeHosting.length,
    openTasksCount: taskStats.openTotal,
    openTasksCustomerLinked: taskStats.customerLinked,
    openTasksLegacyOnly: taskStats.legacyOnly,
    unpaidCommissionsCount: unpaidCommissions.length,
    unpaidCommissionsTotal: unpaidCommissions.reduce((s, c) => s + Number(c.amount || 0), 0),
    unlinkedInboundCount: unlinkedInbound.length,
    overdueTasksCount,
    hasAnyData,
  };
}

const ACTION_PRIORITY: Record<string, number> = {
  reconcile: 1,
  "tasks-overdue": 2,
  "tasks-link": 3,
  finance: 4,
  "projects-waiting": 5,
  "add-note": 6,
  "open-lead": 7,
  "all-clear": 99,
};

function sortActions(actions: RecommendedAction[]): RecommendedAction[] {
  return [...actions].sort(
    (a, b) => (ACTION_PRIORITY[a.id] ?? 50) - (ACTION_PRIORITY[b.id] ?? 50),
  );
}

export function computeRecommendedActions(
  data: CustomerWorkbenchData,
  summary: WorkbenchSummary,
): RecommendedAction[] {
  const actions: RecommendedAction[] = [];
  const primaryLead = data.leads[0];

  if (summary.unlinkedInboundCount > 0) {
    actions.push({
      id: "reconcile",
      label: "Skontrolovať neprepojenú komunikáciu",
      detail: `${summary.unlinkedInboundCount} prichádzajúcich bez customer_id`,
      tab: "komunikacia",
      tone: "warning",
    });
  }

  if (summary.overdueTasksCount > 0) {
    actions.push({
      id: "tasks-overdue",
      label: "Po termíne úlohy",
      detail: `${summary.overdueTasksCount} úloh`,
      tab: "ulohy",
      tone: "warning",
    });
  }

  if (summary.openTasksLegacyOnly > 0) {
    actions.push({
      id: "tasks-link",
      label: "Doplniť prepojenie úloh",
      detail: `${summary.openTasksLegacyOnly} bez customer_id`,
      tab: "ulohy",
      tone: "warning",
    });
  }

  if (summary.unpaidCommissionsCount > 0) {
    actions.push({
      id: "finance",
      label: "Skontrolovať nevyplatené provízie",
      detail: `${summary.unpaidCommissionsCount} · ${summary.unpaidCommissionsTotal.toFixed(2)} €`,
      tab: "financie",
      tone: "warning",
    });
  }

  const waitingProjects = data.notes.filter((n) => n.status === "waiting");
  if (waitingProjects.length > 0) {
    actions.push({
      id: "projects-waiting",
      label: "Projekty čakajú na klienta",
      detail: `${waitingProjects.length}`,
      tab: "projekty",
    });
  }

  const canLogCommunication = !!(summary.emailKey || data.canonicalCustomer?.id);
  if (data.commEvents.length === 0 && canLogCommunication) {
    actions.push({
      id: "add-note",
      label: "Začať komunikačnú históriu",
      detail: "Pridajte internú poznámku alebo počkajte na e-mail",
      tab: "komunikacia",
    });
  }

  if (primaryLead) {
    actions.push({
      id: "open-lead",
      label: "Otvoriť hlavný lead",
      detail: primaryLead.name,
      href: `/admin?lead=${primaryLead.id}`,
    });
  }

  if (actions.length === 0) {
    return [
      {
        id: "all-clear",
        label: "Všetko v poriadku",
        detail: "Žiadne urgentné kroky",
        tab: "prehlad",
      },
    ];
  }

  return sortActions(actions).slice(0, 5);
}

/**
 * Per-customer financial summary (Fáza 2.3). Reuses resolveProfitDisplayContext (src/lib/profit)
 * so "no revenue yet" / "cost without revenue" cases stay safe.
 *
 * Truth levels (CLAUDE.md): *_fact = potvrdené (zelená), legacy_import = historický import (oranžová),
 * workflow_only = nepotvrdený pracovný záznam (sivá) — rental_payments (očakávané platby) majú vždy
 * workflow_only.
 */
export function computeCustomerFinanceSummary(
  data: CustomerWorkbenchData,
): CustomerFinanceSummary {
  let paymentsReceivedFactTotal = 0;
  let paymentsReceivedLegacyTotal = 0;
  let paymentsReceivedTotal = 0;
  data.paymentRecords.forEach((p) => {
    const amount = Number(p.amount) || 0;
    paymentsReceivedTotal += amount;
    if (p.truth_level === "payment_fact") paymentsReceivedFactTotal += amount;
    else if (p.truth_level === "legacy_import") paymentsReceivedLegacyTotal += amount;
  });

  const paymentsExpectedTotal = data.rentalPayments
    .filter((rp) => !rp.paid)
    .reduce((sum, rp) => sum + (Number(rp.custom_price ?? rp.amount) || 0), 0);

  let costsFactTotal = 0;
  let costsLegacyTotal = 0;
  let costsTotal = 0;
  data.costRecords.forEach((c) => {
    const amount = Number(c.amount) || 0;
    costsTotal += amount;
    if (c.truth_level === "cost_fact") costsFactTotal += amount;
    else if (c.truth_level === "legacy_import") costsLegacyTotal += amount;
  });

  const grossProfit = resolveProfitDisplayContext({
    entityKind: "customer",
    revenueKnown: true,
    revenue: paymentsReceivedTotal,
    operatingCost: costsTotal,
  });

  const payoutByImplementer = new Map<string, CommissionPayout>();
  let paidCommissionsTotal = 0;
  data.payoutRecords.forEach((p) => {
    const amount = Number(p.amount) || 0;
    paidCommissionsTotal += amount;
    const key = p.implementer || "Neznámy";
    const existing = payoutByImplementer.get(key);
    if (existing) {
      existing.total += amount;
      existing.count += 1;
    } else {
      payoutByImplementer.set(key, { implementer: key, total: amount, count: 1 });
    }
  });
  const paidCommissionsByImplementer = Array.from(payoutByImplementer.values()).sort(
    (a, b) => b.total - a.total,
  );

  const netProfitCanShow = grossProfit.canShowProfit;
  const netProfit = netProfitCanShow ? (grossProfit.profit ?? 0) - paidCommissionsTotal : null;

  return {
    paymentsReceivedTotal,
    paymentsReceivedFactTotal,
    paymentsReceivedLegacyTotal,
    paymentsExpectedTotal,
    costsTotal,
    costsFactTotal,
    costsLegacyTotal,
    grossProfit,
    paidCommissionsTotal,
    paidCommissionsByImplementer,
    netProfit,
    netProfitCanShow,
  };
}

export function computeUnresolvedIssues(
  data: CustomerWorkbenchData,
  summary: WorkbenchSummary,
): string[] {
  const issues: string[] = [];
  if (!data.canonicalCustomer && data.viewMode === "email") {
    issues.push("Heuristický pohľad — chýba canonical customer záznam");
  }
  if (summary.unlinkedInboundCount > 0) {
    issues.push(`${summary.unlinkedInboundCount} prichádzajúcich e-mailov bez customer_id`);
  }
  if (summary.unpaidCommissionsCount > 0) {
    issues.push(`${summary.unpaidCommissionsCount} nevyplatených provízií`);
  }
  if (summary.overdueTasksCount > 0) {
    issues.push(`${summary.overdueTasksCount} úloh po termíne`);
  }
  if (summary.openTasksLegacyOnly > 0) {
    issues.push(`${summary.openTasksLegacyOnly} otvorených úloh bez customer_id`);
  }
  if (data.tasks.some((t) => t.matchedBy === "client_name")) {
    issues.push("Niektoré úlohy spárované len podľa mena klienta");
  }
  if (data.designs.some((d) => d.matchedBy === "client_name")) {
    issues.push("Niektoré dizajny spárované len podľa mena");
  }
  return issues;
}
