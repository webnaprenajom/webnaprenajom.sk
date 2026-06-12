/**
 * Identity health metrics (Batch RC5) — fetch + checklist.
 */

import { supabase } from "@/integrations/supabase/client";
import { fetchLegacyHealthCounts } from "./legacyHealthReport";
import {
  buildIdentityHealthChecklist,
  type IdentityHealthCounts,
  type IdentityHealthItem,
} from "./identityHealthChecklist";
import {
  findDuplicateCustomerCandidates,
  planRentalCustomerLink,
  type CustomerRecordLite,
} from "./customerIdentityRules";

export {
  buildIdentityHealthChecklist,
  buildLegacyHealthChecklist,
  legacyHealthSeverity,
  type IdentityHealthCounts,
  type IdentityHealthItem,
  type LegacyHealthCounts,
  type LegacyHealthItem,
} from "./identityHealthChecklist";

export async function fetchIdentityHealthCounts(): Promise<{
  data: IdentityHealthCounts | null;
  error: string | null;
}> {
  const legacy = await fetchLegacyHealthCounts();
  if (legacy.error || !legacy.data) {
    return { data: null, error: legacy.error ?? "Legacy health failed" };
  }

  try {
    const [
      rentalsNoCustRes,
      rentalsWithNameRes,
      commNoCustRes,
      customersRes,
      customersNoEmailRes,
    ] = await Promise.all([
      supabase
        .from("rental_websites")
        .select("id", { count: "exact", head: true })
        .is("customer_id", null)
        .not("client_name", "is", null),
      supabase
        .from("rental_websites")
        .select("id,client_name")
        .is("customer_id", null)
        .not("client_name", "is", null),
      supabase
        .from("commissions")
        .select("id", { count: "exact", head: true })
        .is("customer_id", null)
        .is("customer_email", null),
      supabase.from("customers").select("id,email,display_name,created_at").limit(500),
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .is("email", null),
    ]);

    const firstError =
      rentalsNoCustRes.error ||
      rentalsWithNameRes.error ||
      commNoCustRes.error ||
      customersRes.error ||
      customersNoEmailRes.error;
    if (firstError) return { data: null, error: firstError.message };

    const customers = (customersRes.data || []) as CustomerRecordLite[];
    const duplicateCandidates = findDuplicateCustomerCandidates(customers);

    let rentalsBackfillableViaLead = 0;
    if (rentalsWithNameRes.data && rentalsWithNameRes.data.length > 0) {
      const { data: leads } = await supabase
        .from("leads")
        .select("id,name,customer_id")
        .not("customer_id", "is", null);
      if (leads) {
        const plans = planRentalCustomerLink(
          rentalsWithNameRes.data as Array<{ id: string; client_name: string | null }>,
          leads as Array<{ id: string; name: string; customer_id?: string | null }>,
        );
        rentalsBackfillableViaLead = plans.filter((p) => p.outcome === "auto_linked").length;
      }
    }

    return {
      data: {
        ...legacy.data,
        rentalsWithoutCustomer: rentalsNoCustRes.count ?? 0,
        rentalsBackfillableViaLead,
        commissionsWithoutCustomer: commNoCustRes.count ?? 0,
        duplicateCustomerCandidates: duplicateCandidates.length,
        customersWithoutEmail: customersNoEmailRes.count ?? 0,
      },
      error: null,
    };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Neznáma chyba" };
  }
}

export { fetchLegacyHealthCounts };
