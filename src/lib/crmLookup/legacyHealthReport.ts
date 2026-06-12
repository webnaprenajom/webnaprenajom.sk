/**
 * Legacy data visibility report (Batch RC1) — fetch counts from Supabase.
 */

import { supabase } from "@/integrations/supabase/client";

export {
  buildLegacyHealthChecklist,
  legacyHealthSeverity,
  type LegacyHealthCounts,
  type LegacyHealthItem,
  type LegacyHealthSeverity,
} from "./identityHealthChecklist";

export async function fetchLegacyHealthCounts(): Promise<{
  data: import("./identityHealthChecklist").LegacyHealthCounts | null;
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
