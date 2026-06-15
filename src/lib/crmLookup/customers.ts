import { supabase } from "@/integrations/supabase/client";
import { clientNameCompareKey, normalizeClientName, normalizeEmail } from "./normalizeIdentity";
import {
  assessCustomerCreateRisk,
  resolveIdentityMatchLevel,
  type CustomerRecordLite,
  type IdentityMatchLevel,
} from "./customerIdentityRules";

export {
  assessCustomerCreateRisk,
  findDuplicateCustomerCandidates,
  identityMatchLabel,
  mergePriorityFields,
  pickCanonicalCustomerRecord,
  planRentalCustomerLink,
  resolveIdentityMatchLevel,
  type CustomerCreateRisk,
  type CustomerRecordLite,
  type DuplicateCandidate,
  type IdentityMatchLevel,
} from "./customerIdentityRules";

export interface CustomerRow {
  id: string;
  email: string | null;
  display_name: string;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  active: boolean;
}

export { isCanonicalCustomerId } from "./entityIds";
import { isCanonicalCustomerId } from "./entityIds";

export function isCustomerEmailKey(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  return value.includes("@") && !isCanonicalCustomerId(value);
}

export async function findCustomerById(id: string): Promise<CustomerRow | null> {
  const { data, error } = await supabase
    .from("customers")
    .select("id,email,display_name,metadata,created_at,updated_at,active")
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
    .select("id,email,display_name,metadata,created_at,updated_at,active")
    .eq("email", normalized)
    .maybeSingle();
  if (error || !data) return null;
  return data as CustomerRow;
}

async function findCustomersByDisplayName(displayName: string): Promise<CustomerRow[]> {
  const compareKey = clientNameCompareKey(displayName);
  if (!compareKey) return [];
  const { data, error } = await supabase
    .from("customers")
    .select("id,email,display_name,metadata,created_at,updated_at,active")
    .limit(300);
  if (error || !data) return [];
  return (data as CustomerRow[]).filter(
    (c) => clientNameCompareKey(c.display_name) === compareKey,
  );
}

/** Create customer by email with duplicate guardrails (Batch RC5). */
export async function ensureCustomerByEmail(
  email: string,
  displayName: string,
  options?: { allowReviewCreate?: boolean },
): Promise<{ row: CustomerRow | null; warning?: string; blocked?: boolean }> {
  const normalized = normalizeEmail(email);
  const name = normalizeClientName(displayName) || displayName.trim();
  if (!normalized || !name) return { row: null };

  const existing = await findCustomerByEmail(normalized);
  if (existing) return { row: existing };

  const nameMatches = await findCustomersByDisplayName(name);
  const assessment = assessCustomerCreateRisk(
    { email: normalized, displayName: name },
    null,
    nameMatches as CustomerRecordLite[],
  );

  if (assessment.risk === "link_existing" && assessment.linkToId) {
    const linked = await findCustomerById(assessment.linkToId);
    return { row: linked, warning: assessment.message };
  }
  if (assessment.risk === "blocked_ambiguous") {
    return { row: null, blocked: true, warning: assessment.message };
  }
  if (assessment.risk === "review_needed" && !options?.allowReviewCreate) {
    return { row: null, warning: assessment.message };
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      email: normalized,
      display_name: name,
      metadata: { source: "app_ensure", created_via: "ensureCustomerByEmail" },
    })
    .select("id,email,display_name,metadata,created_at,updated_at,active")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      const raced = await findCustomerByEmail(normalized);
      return { row: raced, warning: "Zákazník medzitým vytvoril iný proces." };
    }
    return { row: null, warning: error.message };
  }
  return { row: (data as CustomerRow) ?? null };
}

export interface CustomerLinkFields {
  customer_id: string | null;
  customer_email: string | null;
  client_name: string;
  identity_match?: IdentityMatchLevel;
  warnings?: string[];
}

/** Resolve customer_id for save payloads — golden-record precedence (Batch RC5). */
export async function resolveCustomerLinkFields(input: {
  customer_id?: string | null;
  customer_email?: string | null;
  client_name?: string | null;
  createIfMissing?: boolean;
  manual_link?: boolean;
  allowReviewCreate?: boolean;
}): Promise<CustomerLinkFields> {
  const warnings: string[] = [];
  const client_name = normalizeClientName(input.client_name) || input.client_name?.trim() || "";
  const customer_email = normalizeEmail(input.customer_email);
  const identity_match = resolveIdentityMatchLevel({
    customer_id: input.customer_id,
    customer_email,
    client_name,
    manual_link: input.manual_link,
  });

  if (input.customer_id && isCanonicalCustomerId(input.customer_id)) {
    const row = await findCustomerById(input.customer_id);
    return {
      customer_id: row?.id ?? input.customer_id,
      customer_email: row?.email ?? customer_email,
      client_name: client_name || row?.display_name || "",
      identity_match: "customer_id",
      warnings,
    };
  }

  if (customer_email) {
    if (input.createIfMissing !== false) {
      const ensured = await ensureCustomerByEmail(customer_email, client_name || customer_email.split("@")[0], {
        allowReviewCreate: input.allowReviewCreate,
      });
      if (ensured.warning) warnings.push(ensured.warning);
      if (ensured.blocked) {
        return { customer_id: null, customer_email, client_name, identity_match, warnings };
      }
      if (ensured.row) {
        return {
          customer_id: ensured.row.id,
          customer_email: ensured.row.email,
          client_name: client_name || ensured.row.display_name,
          identity_match: "email",
          warnings,
        };
      }
    } else {
      const row = await findCustomerByEmail(customer_email);
      if (row) {
        return {
          customer_id: row.id,
          customer_email: row.email,
          client_name: client_name || row.display_name,
          identity_match: "email",
          warnings,
        };
      }
    }
  }

  return { customer_id: null, customer_email, client_name, identity_match, warnings };
}
