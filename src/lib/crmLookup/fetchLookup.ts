import { supabase } from "@/integrations/supabase/client";
import {
  buildPostgrestIlikeOr,
  lookupQueryTokens,
  normalizeEmail,
  normalizeClientName,
} from "./normalizeIdentity";
import { isCanonicalCustomerId } from "./customers";
import {
  mapCustomerSearchRow,
  mapLeadSearchRow,
  mergeClientSearchResults,
} from "./clientSearch";
import type { LookupKind, LookupResult } from "./types";

const DEFAULT_LIMIT = 25;

export type LookupFetchResult = {
  rows: LookupResult[];
  error: string | null;
};

async function searchCustomers(q: string, limit: number): Promise<LookupFetchResult> {
  if (q && isCanonicalCustomerId(q)) {
    const { data, error } = await supabase
      .from("customers")
      .select("id,email,display_name")
      .eq("id", q)
      .maybeSingle();
    if (error) return { rows: [], error: error.message };
    if (!data) return { rows: [], error: null };
    return {
      rows: [
        {
          kind: "customer" as const,
          id: data.id,
          label: data.display_name,
          sublabel: data.email || undefined,
          email: normalizeEmail(data.email),
          clientName: normalizeClientName(data.display_name),
          meta: { customer_id: data.id },
        },
      ],
      error: null,
    };
  }

  let req = supabase
    .from("customers")
    .select("id,email,display_name")
    .order("updated_at", { ascending: false })
    .limit(limit);

  const orFilter = q ? buildPostgrestIlikeOr(["display_name", "email"], q) : null;
  if (orFilter) req = req.or(orFilter);

  const { data, error } = await req;
  if (error) return { rows: [], error: error.message };
  if (!data) return { rows: [], error: null };

  return {
    rows: (data as any[]).map((row) => mapCustomerSearchRow(row)),
    error: null,
  };
}

/** Customers first, then leads not already covered by customer email. */
async function searchClientsCombined(q: string, limit: number): Promise<LookupFetchResult> {
  const half = Math.ceil(limit / 2);
  const [customerRes, leadRes] = await Promise.all([
    searchCustomers(q, half),
    searchLeads(q, half, "lead"),
  ]);

  if (customerRes.error && leadRes.error) {
    return { rows: [], error: customerRes.error };
  }

  return {
    rows: mergeClientSearchResults(customerRes.rows, leadRes.rows, limit),
    error: customerRes.error || leadRes.error,
  };
}

export async function fetchLookup(
  kind: LookupKind,
  query = "",
  limit = DEFAULT_LIMIT,
): Promise<LookupResult[]> {
  const result = await fetchLookupWithMeta(kind, query, limit);
  return result.rows;
}

export async function fetchLookupWithMeta(
  kind: LookupKind,
  query = "",
  limit = DEFAULT_LIMIT,
): Promise<LookupFetchResult> {
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
      return { rows: [], error: null };
  }
}

async function searchLeads(q: string, limit: number, kind: LookupKind): Promise<LookupFetchResult> {
  let req = supabase
    .from("leads")
    .select("id,name,email,customer_id,status")
    .order("created_at", { ascending: false })
    .limit(limit);

  const orFilter = q ? buildPostgrestIlikeOr(["name", "email"], q) : null;
  if (orFilter) req = req.or(orFilter);

  const { data, error } = await req;
  if (error) return { rows: [], error: error.message };
  if (!data) return { rows: [], error: null };

  return {
    rows: data.map((row) =>
      mapLeadSearchRow({
        id: row.id,
        name: row.name,
        email: row.email,
        customer_id: row.customer_id,
        status: row.status,
      }),
    ),
    error: null,
  };
}

async function searchProjects(q: string, limit: number): Promise<LookupFetchResult> {
  let req = supabase
    .from("project_notes")
    .select("id,title,client_name,customer_email,url,project_type")
    .order("updated_at", { ascending: false })
    .limit(limit);

  const orFilter = q
    ? buildPostgrestIlikeOr(["title", "client_name", "customer_email", "url"], q)
    : null;
  if (orFilter) req = req.or(orFilter);

  const { data, error } = await req;
  if (error) return { rows: [], error: error.message };
  if (!data) return { rows: [], error: null };

  return {
    rows: (data as any[]).map((row) => ({
      kind: "project" as const,
      id: row.id,
      label: row.title,
      sublabel: [row.client_name, row.url].filter(Boolean).join(" · ") || undefined,
      email: normalizeEmail(row.customer_email),
      clientName: normalizeClientName(row.client_name),
      meta: { project_type: row.project_type },
    })),
    error: null,
  };
}

async function searchRentals(q: string, limit: number): Promise<LookupFetchResult> {
  let req = supabase
    .from("rental_websites")
    .select("id,name,url,client_name")
    .order("created_at", { ascending: false })
    .limit(limit);

  const orFilter = q ? buildPostgrestIlikeOr(["name", "client_name", "url"], q) : null;
  if (orFilter) req = req.or(orFilter);

  const { data, error } = await req;
  if (error) return { rows: [], error: error.message };
  if (!data) return { rows: [], error: null };

  return {
    rows: (data as any[]).map((row) => ({
      kind: "rental" as const,
      id: row.id,
      label: row.name || row.url || row.client_name || "Prenájom",
      sublabel: row.client_name || row.url || undefined,
      clientName: normalizeClientName(row.client_name),
    })),
    error: null,
  };
}

async function searchHosting(q: string, limit: number): Promise<LookupFetchResult> {
  let req = supabase
    .from("hosting_records")
    .select("id,client_name,customer_email,provider,monthly_price")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  const orFilter = q
    ? buildPostgrestIlikeOr(["client_name", "customer_email", "provider"], q)
    : null;
  if (orFilter) req = req.or(orFilter);

  const { data, error } = await req;
  if (error) return { rows: [], error: error.message };
  if (!data) return { rows: [], error: null };

  return {
    rows: (data as any[]).map((row) => ({
      kind: "hosting" as const,
      id: row.id,
      label: row.client_name || row.customer_email || row.provider || "Hosting",
      sublabel: [row.provider, row.monthly_price != null ? `${row.monthly_price} €/mes` : null]
        .filter(Boolean)
        .join(" · ") || undefined,
      email: normalizeEmail(row.customer_email),
      clientName: normalizeClientName(row.client_name),
    })),
    error: null,
  };
}
