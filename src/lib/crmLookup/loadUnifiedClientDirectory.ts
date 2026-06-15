import { supabase } from "@/integrations/supabase/client";
import { normalizeClientName, normalizeEmail, clientNameCompareKey } from "./normalizeIdentity";
import {
  mergeUnifiedClientSeeds,
  type UnifiedClientEntry,
  type UnifiedClientSeed,
} from "./unifiedClientDedupe";

export type { UnifiedClientEntry };

/** Aktívni (default) | Neaktívni | Všetci — filtruje iba `customers` query (Fáza 1+2). */
export type ClientDirectoryMode = "active" | "inactive" | "all";

export async function loadUnifiedClientDirectory(
  limit = 24,
  mode: ClientDirectoryMode = "active",
): Promise<{ entries: UnifiedClientEntry[]; error: string | null }> {
  const seeds: UnifiedClientSeed[] = [];

  let customersQuery = supabase
    .from("customers")
    .select("id,email,display_name")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (mode === "active") customersQuery = customersQuery.eq("active", true);
  else if (mode === "inactive") customersQuery = customersQuery.eq("active", false);

  const [customersRes, projectsRes, hostingRes, rentalsRes, leadsRes] = await Promise.all([
    customersQuery,
    supabase.from("project_notes").select("customer_id,customer_email,client_name"),
    supabase.from("hosting_records").select("customer_id,customer_email,client_name"),
    (supabase as any).from("rental_websites").select("client_name,customer_id,customer_email"),
    supabase.from("leads").select("id,name,email,customer_id"),
  ]);

  if (customersRes.error) {
    return { entries: [], error: customersRes.error.message };
  }

  for (const p of projectsRes.data || []) {
    seeds.push({
      customerId: p.customer_id,
      displayName: p.client_name || p.customer_email || "Projekt",
      email: p.customer_email,
      section: "project",
    });
  }

  for (const h of hostingRes.data || []) {
    seeds.push({
      customerId: h.customer_id,
      displayName: h.client_name || h.customer_email || "Hosting",
      email: h.customer_email,
      section: "hosting",
    });
  }

  for (const r of rentalsRes.data || []) {
    if (!r.client_name?.trim() && !r.customer_id) continue;
    seeds.push({
      customerId: r.customer_id,
      displayName: r.client_name || "Prenájom",
      email: r.customer_email,
      section: "rental",
    });
  }

  for (const l of leadsRes.data || []) {
    seeds.push({
      customerId: l.customer_id,
      displayName: l.name || l.email || "Lead",
      email: l.email,
      section: "lead",
    });
  }

  let entries = mergeUnifiedClientSeeds(seeds);

  const seenCustomerIds = new Set(entries.map((e) => e.customerId).filter(Boolean));
  for (const c of customersRes.data || []) {
    if (!seenCustomerIds.has(c.id)) {
      entries.push({
        customerId: c.id,
        displayName: normalizeClientName(c.display_name) || c.display_name,
        email: normalizeEmail(c.email),
        nameKey: clientNameCompareKey(c.display_name),
        sections: new Set(),
        projectCount: 0,
        hostingCount: 0,
        rentalCount: 0,
        leadCount: 0,
      });
    }
  }

  entries = entries.slice(0, limit);

  // Prefer canonical customers with known IDs at top
  entries.sort((a, b) => {
    if (a.customerId && !b.customerId) return -1;
    if (!a.customerId && b.customerId) return 1;
    return a.displayName.localeCompare(b.displayName, "sk");
  });

  return { entries, error: null };
}

/** Lookup helper — match rental rows to unified entry by normalized name. */
export function rentalMatchesClient(
  rentalClientName: string | null | undefined,
  entry: UnifiedClientEntry,
): boolean {
  const rentalKey = normalizeClientName(rentalClientName)?.toLowerCase();
  if (!rentalKey || !entry.nameKey) return false;
  return rentalKey === entry.nameKey;
}

export { normalizeEmail };
