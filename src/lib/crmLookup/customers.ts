import { supabase } from "@/integrations/supabase/client";
import { normalizeClientName, normalizeEmail } from "./normalizeIdentity";

export interface CustomerRow {
  id: string;
  email: string | null;
  display_name: string;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCanonicalCustomerId(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  return UUID_RE.test(value.trim());
}

export function isCustomerEmailKey(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  return value.includes("@") && !isCanonicalCustomerId(value);
}

export async function findCustomerById(id: string): Promise<CustomerRow | null> {
  const { data, error } = await supabase
    .from("customers")
    .select("id,email,display_name,metadata,created_at,updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as CustomerRow;
}

export async function findCustomerByEmail(email: string): Promise<CustomerRow | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const { data, error } = await supabase
    .from("customers")
    .select("id,email,display_name,metadata,created_at,updated_at")
    .eq("email", normalized)
    .maybeSingle();
  if (error || !data) return null;
  return data as CustomerRow;
}

/** Create customer by email if missing — never merges ambiguous duplicates. */
export async function ensureCustomerByEmail(
  email: string,
  displayName: string,
): Promise<CustomerRow | null> {
  const normalized = normalizeEmail(email);
  const name = normalizeClientName(displayName) || displayName.trim();
  if (!normalized || !name) return null;

  const existing = await findCustomerByEmail(normalized);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("customers")
    .insert({
      email: normalized,
      display_name: name,
      metadata: { source: "app_ensure", created_via: "ensureCustomerByEmail" },
    })
    .select("id,email,display_name,metadata,created_at,updated_at")
    .maybeSingle();

  if (error) {
    // Race: another row inserted same email
    if (error.code === "23505") return findCustomerByEmail(normalized);
    return null;
  }
  return (data as CustomerRow) ?? null;
}

export interface CustomerLinkFields {
  customer_id: string | null;
  customer_email: string | null;
  client_name: string;
}

/** Resolve customer_id for save payloads — preserves legacy email/name, never overwrites display_name in DB. */
export async function resolveCustomerLinkFields(input: {
  customer_id?: string | null;
  customer_email?: string | null;
  client_name?: string | null;
  createIfMissing?: boolean;
}): Promise<CustomerLinkFields> {
  const client_name = normalizeClientName(input.client_name) || input.client_name?.trim() || "";
  const customer_email = normalizeEmail(input.customer_email);

  if (input.customer_id && isCanonicalCustomerId(input.customer_id)) {
    const row = await findCustomerById(input.customer_id);
    return {
      customer_id: row?.id ?? input.customer_id,
      customer_email: row?.email ?? customer_email,
      client_name: client_name || row?.display_name || "",
    };
  }

  if (customer_email) {
    if (input.createIfMissing !== false) {
      const row = await ensureCustomerByEmail(
        customer_email,
        client_name || customer_email.split("@")[0],
      );
      if (row) {
        return { customer_id: row.id, customer_email: row.email, client_name: client_name || row.display_name };
      }
    } else {
      const row = await findCustomerByEmail(customer_email);
      if (row) {
        return { customer_id: row.id, customer_email: row.email, client_name: client_name || row.display_name };
      }
    }
  }

  return { customer_id: null, customer_email, client_name };
}
