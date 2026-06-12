/**
 * Client search result shaping — leads linked to customers surface as Klient (Batch RC3).
 */

import type { LookupResult } from "./types";
import { normalizeEmail, normalizeClientName } from "./normalizeIdentity";
import { isCanonicalCustomerId } from "./entityIds";

export type LeadSearchRow = {
  id: string;
  name: string | null;
  email: string | null;
  customer_id?: string | null;
  status?: string | null;
};

export type CustomerSearchRow = {
  id: string;
  display_name: string;
  email: string | null;
};

/** Map DB lead row to lookup result; linked leads appear as Klient when customer_id set. */
export function mapLeadSearchRow(row: LeadSearchRow): LookupResult {
  const email = normalizeEmail(row.email);
  const clientName = normalizeClientName(row.name);
  const linkedCustomerId =
    row.customer_id && isCanonicalCustomerId(row.customer_id) ? row.customer_id : null;

  if (linkedCustomerId) {
    return {
      kind: "customer",
      id: linkedCustomerId,
      label: clientName || email || "Klient",
      sublabel: email || undefined,
      email,
      clientName,
      meta: {
        customer_id: linkedCustomerId,
        lead_id: row.id,
        lead_status: row.status ?? undefined,
        promoted_from_lead: true,
      },
    };
  }

  return {
    kind: "lead",
    id: row.id,
    label: (row.name || row.email || "—").trim(),
    sublabel: email || undefined,
    email,
    clientName,
    meta: { lead_status: row.status ?? undefined },
  };
}

export function mapCustomerSearchRow(row: CustomerSearchRow): LookupResult {
  return {
    kind: "customer",
    id: row.id,
    label: row.display_name,
    sublabel: row.email || undefined,
    email: normalizeEmail(row.email),
    clientName: normalizeClientName(row.display_name),
    meta: { customer_id: row.id },
  };
}

/** Merge customers + leads; dedupe by email and customer_id. */
export function mergeClientSearchResults(
  customers: LookupResult[],
  leads: LookupResult[],
  limit: number,
): LookupResult[] {
  const seenEmails = new Set(customers.map((c) => c.email).filter(Boolean) as string[]);
  const seenCustomerIds = new Set(
    customers.map((c) => c.id).filter((id) => isCanonicalCustomerId(id)),
  );

  const dedupedLeads = leads.filter((l) => {
    if (l.kind === "customer" || l.meta?.promoted_from_lead) {
      if (l.id && seenCustomerIds.has(l.id)) return false;
      if (l.email && seenEmails.has(l.email)) return false;
      if (l.id && isCanonicalCustomerId(l.id)) seenCustomerIds.add(l.id);
      if (l.email) seenEmails.add(l.email);
      return true;
    }
    if (!l.email) return true;
    return !seenEmails.has(l.email);
  });

  return [...customers, ...dedupedLeads].slice(0, limit);
}
