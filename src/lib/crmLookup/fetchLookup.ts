import { supabase } from "@/integrations/supabase/client";
import { normalizeEmail, normalizeClientName, lookupQueryTokens } from "./normalizeIdentity";
import type { LookupKind, LookupResult } from "./types";

const DEFAULT_LIMIT = 25;

async function searchCustomers(q: string, limit: number): Promise<LookupResult[]> {
  let req = supabase
    .from("customers")
    .select("id,email,display_name")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (q) {
    req = req.or(`display_name.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data, error } = await req;
  if (error || !data) return [];

  return (data as any[]).map((row) => ({
    kind: "customer" as const,
    id: row.id,
    label: row.display_name,
    sublabel: row.email || undefined,
    email: normalizeEmail(row.email),
    clientName: normalizeClientName(row.display_name),
    meta: { customer_id: row.id },
  }));
}

/** Customers first, then leads not already covered by customer email. */
async function searchClientsCombined(q: string, limit: number): Promise<LookupResult[]> {
  const half = Math.ceil(limit / 2);
  const [customers, leads] = await Promise.all([
    searchCustomers(q, half),
    searchLeads(q, half, "lead"),
  ]);

  const seenEmails = new Set(
    customers.map((c) => c.email).filter(Boolean) as string[],
  );

  const dedupedLeads = leads.filter((l) => {
    if (!l.email) return true;
    return !seenEmails.has(l.email);
  });

  return [...customers, ...dedupedLeads].slice(0, limit);
}

export async function fetchLookup(
  kind: LookupKind,
  query = "",
  limit = DEFAULT_LIMIT,
): Promise<LookupResult[]> {
  const q = lookupQueryTokens(query);

  switch (kind) {
    case "client":
      return searchClientsCombined(q, limit);
    case "customer":
      return searchCustomers(q, limit);
    case "lead":
    case "email":
      return searchLeads(q, limit, kind);
    case "project":
      return searchProjects(q, limit);
    case "rental":
      return searchRentals(q, limit);
    case "hosting":
      return searchHosting(q, limit);
    default:
      return [];
  }
}

async function searchLeads(q: string, limit: number, kind: LookupKind): Promise<LookupResult[]> {
  let req = supabase
    .from("leads")
    .select("id,name,email")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (q) {
    req = req.or(`name.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data, error } = await req;
  if (error || !data) return [];

  return data.map((row) => ({
    kind: kind === "email" ? "email" : "lead",
    id: row.id,
    label: (row.name || row.email || "—").trim(),
    sublabel: row.email || undefined,
    email: normalizeEmail(row.email),
    clientName: normalizeClientName(row.name),
  }));
}

async function searchProjects(q: string, limit: number): Promise<LookupResult[]> {
  let req = supabase
    .from("project_notes")
    .select("id,title,client_name,customer_email,url,project_type")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (q) {
    req = req.or(`title.ilike.%${q}%,client_name.ilike.%${q}%,customer_email.ilike.%${q}%,url.ilike.%${q}%`);
  }

  const { data, error } = await req;
  if (error || !data) return [];

  return (data as any[]).map((row) => ({
    kind: "project" as const,
    id: row.id,
    label: row.title,
    sublabel: [row.client_name, row.url].filter(Boolean).join(" · ") || undefined,
    email: normalizeEmail(row.customer_email),
    clientName: normalizeClientName(row.client_name),
    meta: { project_type: row.project_type },
  }));
}

async function searchRentals(q: string, limit: number): Promise<LookupResult[]> {
  let req = (supabase as any)
    .from("rental_websites")
    .select("id,name,url,client_name")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (q) {
    req = req.or(`name.ilike.%${q}%,client_name.ilike.%${q}%,url.ilike.%${q}%`);
  }

  const { data, error } = await req;
  if (error || !data) return [];

  return (data as any[]).map((row) => ({
    kind: "rental" as const,
    id: row.id,
    label: row.name || row.url || row.client_name || "Prenájom",
    sublabel: row.client_name || row.url || undefined,
    clientName: normalizeClientName(row.client_name),
  }));
}

async function searchHosting(q: string, limit: number): Promise<LookupResult[]> {
  let req = supabase
    .from("hosting_records")
    .select("id,client_name,customer_email,provider,monthly_price")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (q) {
    req = req.or(`client_name.ilike.%${q}%,customer_email.ilike.%${q}%,provider.ilike.%${q}%`);
  }

  const { data, error } = await req;
  if (error || !data) return [];

  return (data as any[]).map((row) => ({
    kind: "hosting" as const,
    id: row.id,
    label: row.client_name || row.customer_email || row.provider || "Hosting",
    sublabel: [row.provider, row.monthly_price != null ? `${row.monthly_price} €/mes` : null]
      .filter(Boolean)
      .join(" · ") || undefined,
    email: normalizeEmail(row.customer_email),
    clientName: normalizeClientName(row.client_name),
  }));
}
