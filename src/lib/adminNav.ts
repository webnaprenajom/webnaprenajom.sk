/** Shared admin navigation helpers (read-only linking, no business logic). */

export function adminLeadHref(leadId: string): string {
  return `/admin?lead=${leadId}`;
}

export function adminCustomerHref(email: string): string | null {
  const key = email.trim().toLowerCase();
  if (!key || !key.includes("@")) return null;
  return `/admin/customer/${encodeURIComponent(key)}`;
}

/** First exact lead name → email (used for fuzzy client_name → customer links). */
export function buildClientNameEmailMap(
  leads: Array<{ name: string | null; email: string | null }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const lead of leads) {
    const name = (lead.name || "").trim();
    const href = lead.email ? adminCustomerHref(lead.email) : null;
    if (name && href && !map.has(name)) {
      map.set(name, lead.email!.trim().toLowerCase());
    }
  }
  return map;
}

export function customerHrefByClientName(
  clientName: string | null | undefined,
  map: Map<string, string>,
): string | null {
  if (!clientName) return null;
  const email = map.get(clientName.trim());
  return email ? adminCustomerHref(email) : null;
}

/** First normalized email → lead id (for exact email → pipeline links). */
export function buildEmailLeadIdMap(
  leads: Array<{ id: string; email: string | null }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const lead of leads) {
    const key = lead.email?.trim().toLowerCase();
    if (key && key.includes("@") && !map.has(key)) {
      map.set(key, lead.id);
    }
  }
  return map;
}

export function leadIdByEmail(
  email: string | null | undefined,
  map: Map<string, string>,
): string | null {
  if (!email) return null;
  return map.get(email.trim().toLowerCase()) ?? null;
}
