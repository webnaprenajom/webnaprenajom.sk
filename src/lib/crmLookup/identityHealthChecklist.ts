/**
 * Legacy health checklist — pure (Batch RC1/RC5), no Supabase.
 */

export interface LegacyHealthCounts {
  legacyCommissions: number;
  partialCommissions: number;
  leadsWithoutCustomer: number;
  unlinkedInboundComm: number;
  openTasksWithoutCustomer: number;
  tasksBackfillableViaLead: number;
}

export type LegacyHealthSeverity = "ok" | "info" | "warn";

export interface LegacyHealthItem {
  id: keyof LegacyHealthCounts;
  title: string;
  count: number;
  severity: LegacyHealthSeverity;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}

export function legacyHealthSeverity(count: number, warnAbove = 0): LegacyHealthSeverity {
  if (count === 0) return "ok";
  if (count <= warnAbove) return "info";
  return "warn";
}

export function buildLegacyHealthChecklist(counts: LegacyHealthCounts): LegacyHealthItem[] {
  return [
    {
      id: "legacyCommissions",
      title: "Provízie bez zdroja",
      count: counts.legacyCommissions,
      severity: legacyHealthSeverity(counts.legacyCommissions),
      description:
        "Provízie bez source_type a source_id — neviažu sa na projekt, prenájom ani hosting.",
      actionHref: "/admin/finance?advanced=1&legacy=commissions",
      actionLabel: "Otvoriť provízie",
    },
    {
      id: "partialCommissions",
      title: "Provízie s neúplným prepojením",
      count: counts.partialCommissions,
      severity: legacyHealthSeverity(counts.partialCommissions),
      description: "Riadok má len typ alebo len ID zdroja — treba doplniť obe polia.",
      actionHref: "/admin/finance?advanced=1&legacy=commissions",
      actionLabel: "Skontrolovať",
    },
    {
      id: "leadsWithoutCustomer",
      title: "Leady bez customer_id",
      count: counts.leadsWithoutCustomer,
      severity: legacyHealthSeverity(counts.leadsWithoutCustomer, 5),
      description: "Leady s e-mailom, ktoré ešte nie sú prepojené na kanónického zákazníka.",
      actionHref: "/admin/clients",
      actionLabel: "Klienti",
    },
    {
      id: "unlinkedInboundComm",
      title: "Prichádzajúca komunikácia bez zákazníka",
      count: counts.unlinkedInboundComm,
      severity: legacyHealthSeverity(counts.unlinkedInboundComm),
      description: "Inbound e-maily v communication_events bez customer_id.",
      actionHref: "/admin/communication-ops",
      actionLabel: "Reconciliácia",
    },
    {
      id: "openTasksWithoutCustomer",
      title: "Otvorené úlohy bez customer_id",
      count: counts.openTasksWithoutCustomer,
      severity: legacyHealthSeverity(counts.openTasksWithoutCustomer),
      description: "Aktívne úlohy (≠ hotové) bez priameho prepojenia na zákazníka.",
      actionHref: "/admin/tasks",
      actionLabel: "Úlohy",
    },
    {
      id: "tasksBackfillableViaLead",
      title: "Úlohy s leadom na doplnenie customer_id",
      count: counts.tasksBackfillableViaLead,
      severity: legacyHealthSeverity(counts.tasksBackfillableViaLead, 3),
      description:
        "Úlohy s lead_id, kde lead už má customer_id — bezpečný kandidát na manuálny backfill.",
      actionHref: "/admin/tasks",
      actionLabel: "Úlohy",
    },
  ];
}

export interface IdentityHealthCounts extends LegacyHealthCounts {
  rentalsWithoutCustomer: number;
  rentalsBackfillableViaLead: number;
  commissionsWithoutCustomer: number;
  duplicateCustomerCandidates: number;
  customersWithoutEmail: number;
}

export interface IdentityHealthItem extends LegacyHealthItem {
  id: keyof IdentityHealthCounts;
}

export function buildIdentityHealthChecklist(counts: IdentityHealthCounts): IdentityHealthItem[] {
  const base = buildLegacyHealthChecklist(counts) as IdentityHealthItem[];
  const extra: IdentityHealthItem[] = [
    {
      id: "rentalsWithoutCustomer",
      title: "Prenájmy bez customer_id",
      count: counts.rentalsWithoutCustomer,
      severity: legacyHealthSeverity(counts.rentalsWithoutCustomer, 3),
      description:
        "Weby s client_name alebo bez kanonického prepojenia na zákazníka — customer 360 ich môže vynechať.",
      actionHref: "/admin/rentals",
      actionLabel: "Prenájmy",
    },
    {
      id: "rentalsBackfillableViaLead",
      title: "Prenájmy pripravené na backfill (lead)",
      count: counts.rentalsBackfillableViaLead,
      severity: counts.rentalsBackfillableViaLead > 0 ? "info" : "ok",
      description:
        "Vysoká dôvera: jediný lead s rovnakým menom a customer_id — bezpečný kandidát na prepojenie.",
      actionHref: "/admin/rollout-health",
      actionLabel: "Identita",
    },
    {
      id: "commissionsWithoutCustomer",
      title: "Provízie bez klienta",
      count: counts.commissionsWithoutCustomer,
      severity: legacyHealthSeverity(counts.commissionsWithoutCustomer),
      description: "Provízie bez customer_id aj customer_email — neviditeľné v customer 360.",
      actionHref: "/admin/finance?advanced=1&legacy=commissions",
      actionLabel: "Provízie",
    },
    {
      id: "duplicateCustomerCandidates",
      title: "Kandidáti na duplicitu klientov",
      count: counts.duplicateCustomerCandidates,
      severity: legacyHealthSeverity(counts.duplicateCustomerCandidates),
      description:
        "Rovnaké normalizované meno, rôzne e-maily — pripravené na budúci merge nástroj (zatiaľ len report).",
      actionHref: "/admin/clients",
      actionLabel: "Klienti",
    },
    {
      id: "customersWithoutEmail",
      title: "Klienti bez e-mailu",
      count: counts.customersWithoutEmail,
      severity: legacyHealthSeverity(counts.customersWithoutEmail, 2),
      description: "Kanónický záznam bez e-mailu — slabšia identita pre deduplikáciu a lookup.",
      actionHref: "/admin/clients",
      actionLabel: "Klienti",
    },
  ];
  return [...base, ...extra];
}
