/**
 * Legacy data visibility report (Batch RC1) — counts only, no auto-fixes.
 */

import { supabase } from "@/integrations/supabase/client";

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

/** Build admin checklist rows from fetched counts. */
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

export async function fetchLegacyHealthCounts(): Promise<{
  data: LegacyHealthCounts | null;
  error: string | null;
}> {
  try {
    const [
      legacyCommRes,
      partialCommRes,
      leadsRes,
      unlinkedCommRes,
      openTasksRes,
      backfillTasksRes,
    ] = await Promise.all([
      supabase
        .from("commissions")
        .select("id", { count: "exact", head: true })
        .is("source_type", null)
        .is("source_id", null),
      supabase
        .from("commissions")
        .select("id", { count: "exact", head: true })
        .or(
          "and(source_type.not.is.null,source_id.is.null),and(source_type.is.null,source_id.not.is.null)",
        ),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .is("customer_id", null)
        .not("email", "is", null),
      supabase
        .from("communication_events")
        .select("id", { count: "exact", head: true })
        .eq("kind", "email_in")
        .is("customer_id", null),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .is("customer_id", null)
        .neq("status", "done"),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .is("customer_id", null)
        .not("lead_id", "is", null)
        .neq("status", "done"),
    ]);

    const firstError =
      legacyCommRes.error ||
      partialCommRes.error ||
      leadsRes.error ||
      unlinkedCommRes.error ||
      openTasksRes.error ||
      backfillTasksRes.error;

    if (firstError) {
      return { data: null, error: firstError.message };
    }

    return {
      data: {
        legacyCommissions: legacyCommRes.count ?? 0,
        partialCommissions: partialCommRes.count ?? 0,
        leadsWithoutCustomer: leadsRes.count ?? 0,
        unlinkedInboundComm: unlinkedCommRes.count ?? 0,
        openTasksWithoutCustomer: openTasksRes.count ?? 0,
        tasksBackfillableViaLead: backfillTasksRes.count ?? 0,
      },
      error: null,
    };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Neznáma chyba" };
  }
}
