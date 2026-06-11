/** Shared admin navigation helpers (read-only linking, no business logic). */

import { clientNameCompareKey } from "@/lib/crmLookup/normalizeIdentity";
import { isCanonicalCustomerId } from "@/lib/crmLookup/customers";

export function adminLeadHref(leadId: string): string {
  return `/admin?lead=${leadId}`;
}

/** Canonical customer detail by UUID. */
export function adminCustomerHrefById(customerId: string): string {
  return `/admin/customers/${customerId}`;
}

/** Legacy email-based Klient 360° route (preserved during rollout). */
export function adminCustomerHref(email: string): string | null {
  const key = email.trim().toLowerCase();
  if (!key || !key.includes("@")) return null;
  return `/admin/customer/${encodeURIComponent(key)}`;
}

/** Prefer canonical id route when available, else email route. */
export function adminCustomerHrefPreferred(
  customerId: string | null | undefined,
  email: string | null | undefined,
): string | null {
  if (customerId && isCanonicalCustomerId(customerId)) {
    return adminCustomerHrefById(customerId);
  }
  if (email) return adminCustomerHref(email);
  return null;
}

export function parseCustomerRouteKey(key: string): {
  mode: "id" | "email";
  value: string;
} {
  const decoded = decodeURIComponent(key).trim();
  if (isCanonicalCustomerId(decoded)) {
    return { mode: "id", value: decoded };
  }
  return { mode: "email", value: decoded.toLowerCase() };
}

/** First exact lead name → email (used for fuzzy client_name → customer links). */
export function buildClientNameEmailMap(
  leads: Array<{ name: string | null; email: string | null }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const lead of leads) {
    const key = clientNameCompareKey(lead.name);
    const href = lead.email ? adminCustomerHref(lead.email) : null;
    if (key && href && !map.has(key)) {
      map.set(key, lead.email!.trim().toLowerCase());
    }
  }
  return map;
}

export function customerHrefByClientName(
  clientName: string | null | undefined,
  map: Map<string, string>,
): string | null {
  const key = clientNameCompareKey(clientName);
  if (!key) return null;
  const email = map.get(key);
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

/** First exact lead name → lead id (for client_name → pipeline links). */
export function buildNameLeadIdMap(
  leads: Array<{ id: string; name: string | null }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const lead of leads) {
    const name = (lead.name || "").trim();
    if (name && !map.has(name)) {
      map.set(name, lead.id);
    }
  }
  return map;
}

export function leadIdByClientName(
  clientName: string | null | undefined,
  map: Map<string, string>,
): string | null {
  if (!clientName) return null;
  return map.get(clientName.trim()) ?? null;
}
