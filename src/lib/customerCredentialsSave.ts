import { supabase } from "@/integrations/supabase/client";
import type { EntityOptions } from "@/components/admin/customerCredentials/CredentialFormDialog";
import { resolveFormCustomerLink } from "@/lib/crmLookup/resolveFormCustomerLink";
import {
  assertDeliveryHasCanonicalCustomer,
  parseInsertRowId,
} from "@/lib/crmLookup/entitySaveHelpers";
import type { CustomerLinkFields } from "@/lib/crmLookup/customers";
import {
  type CredentialCategory,
  type CredentialFormItem,
  type CredentialFormState,
  type CustomerCredential,
  filledCredentialItems,
  formStateFromCredentials,
  validateCredentialFormItems,
} from "@/lib/customerCredentials";

export type CustomerCredentialSavePayload = {
  customer_id: string;
  customer_email: string;
  client_name: string | null;
  lead_id: string | null;
  category: CredentialCategory;
  label: string;
  url: string | null;
  login: string | null;
  password: string | null;
  note: string | null;
  linked_entity_type: CustomerCredential["linked_entity_type"];
  linked_entity_id: string | null;
  batch_id: string | null;
};

export function buildCustomerCredentialPayload(
  item: CredentialFormItem,
  form: Pick<
    CredentialFormState,
    "linked_entity_type" | "linked_entity_id" | "lead_id"
  >,
  linked: CustomerLinkFields & { lead_id: string | null },
  batchId: string | null,
): CustomerCredentialSavePayload {
  return {
    customer_id: linked.customer_id!,
    customer_email: linked.customer_email!,
    client_name: linked.client_name || null,
    lead_id: linked.lead_id || form.lead_id || null,
    category: item.category,
    label: item.label.trim(),
    url: item.url?.trim() || null,
    login: item.login?.trim() || null,
    password: item.password?.trim() || null,
    note: item.note?.trim() || null,
    linked_entity_type: form.linked_entity_type || null,
    linked_entity_id: form.linked_entity_id || null,
    batch_id: batchId,
  };
}

export function resolveBatchIdForSave(
  form: CredentialFormState,
  filledCount: number,
): string | null {
  if (filledCount <= 1 && !form.batch_id) return null;
  return form.batch_id || newBatchId();
}

function newBatchId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `batch-${Date.now()}`;
}

export async function loadCredentialFormForEdit(
  item: CustomerCredential,
): Promise<CredentialFormState> {
  if (item.batch_id) {
    const { data, error } = await supabase
      .from("customer_credentials")
      .select("*")
      .eq("batch_id", item.batch_id)
      .order("created_at", { ascending: true });
    if (!error && data?.length) {
      return formStateFromCredentials(data as CustomerCredential[]);
    }
  }
  return formStateFromCredentials([item]);
}

export async function saveCustomerCredentialBatch(
  form: CredentialFormState,
  removedDbIds: string[] = [],
): Promise<
  | { ok: true; savedCount: number }
  | { ok: false; customerFieldError?: string; message: string }
> {
  const itemsError = validateCredentialFormItems(form.items);
  if (itemsError) return { ok: false, message: itemsError };

  const filled = filledCredentialItems(form.items);

  let linked;
  try {
    linked = await resolveFormCustomerLink({
      customer_id: form.customer_id,
      customer_email: form.customer_email,
      client_name: form.client_name,
      lead_id: form.lead_id,
      createIfMissing: true,
    });
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Vyberte klienta alebo zadajte platný e-mail.",
    };
  }

  const customerGuard = assertDeliveryHasCanonicalCustomer(linked);
  if (!customerGuard.ok) {
    return { ok: false, customerFieldError: customerGuard.message, message: customerGuard.message };
  }

  const batchId = resolveBatchIdForSave(form, filled.length);

  if (removedDbIds.length) {
    const { error } = await supabase
      .from("customer_credentials")
      .delete()
      .in("id", removedDbIds);
    if (error) return { ok: false, message: error.message };
  }

  for (const item of filled) {
    const payload = buildCustomerCredentialPayload(item, form, {
      ...linked,
      lead_id: linked.lead_id,
    }, batchId);

    if (item.dbId) {
      const { error } = await supabase
        .from("customer_credentials")
        .update(payload)
        .eq("id", item.dbId);
      if (error) return { ok: false, message: error.message };
    } else {
      const { data: saved, error } = await supabase
        .from("customer_credentials")
        .insert(payload)
        .select("id")
        .maybeSingle();
      const insertResult = parseInsertRowId(saved, error, "Prístup");
      if (!insertResult.ok) return { ok: false, message: insertResult.error };
    }
  }

  return { ok: true, savedCount: filled.length };
}

/** @deprecated Use saveCustomerCredentialBatch — kept for single-item callers/tests */
export async function saveCustomerCredential(
  editing: Partial<CustomerCredential>,
): Promise<{ ok: true } | { ok: false; customerFieldError?: string; message: string }> {
  const form: CredentialFormState = {
    customer_id: editing.customer_id ?? null,
    customer_email: editing.customer_email ?? null,
    client_name: editing.client_name ?? null,
    lead_id: editing.lead_id ?? null,
    batch_id: editing.batch_id ?? null,
    linked_entity_type: editing.linked_entity_type ?? null,
    linked_entity_id: editing.linked_entity_id ?? null,
    items: [
      {
        key: editing.id || "single",
        dbId: editing.id,
        category: editing.category || "web_admin",
        label: editing.label || "",
        url: editing.url || "",
        login: editing.login || "",
        password: editing.password || "",
        note: editing.note || "",
      },
    ],
  };
  const result = await saveCustomerCredentialBatch(form);
  if (!result.ok) return result;
  return { ok: true };
}

export async function deleteCustomerCredential(id: string): Promise<string | null> {
  const { error } = await supabase.from("customer_credentials").delete().eq("id", id);
  return error?.message ?? null;
}

export async function loadCredentialEntityOptions(
  customerId: string | null,
  customerEmail: string | null,
  clientName?: string | null,
): Promise<EntityOptions> {
  if (!customerId && !customerEmail && !clientName?.trim()) return {};

  type Row = { id: string };
  const dedupeLabels = (rows: { id: string; label: string }[]) => {
    const seen = new Map<string, string>();
    rows.forEach((r) => {
      if (!seen.has(r.id)) seen.set(r.id, r.label);
    });
    return Array.from(seen.entries()).map(([id, label]) => ({ id, label }));
  };

  const nameFilter = clientName?.trim() || null;

  const projectQueries: Promise<{ data: Row[] | null }>[] = [];
  const hostingQueries: Promise<{ data: Row[] | null }>[] = [];
  const marketingQueries: Promise<{ data: Row[] | null }>[] = [];
  const rentalQueries: Promise<{ data: Row[] | null }>[] = [];

  if (customerId) {
    projectQueries.push(
      supabase.from("project_notes").select("id,title").eq("customer_id", customerId),
    );
    hostingQueries.push(
      supabase.from("hosting_records").select("id,provider,client_name").eq("customer_id", customerId),
    );
    marketingQueries.push(
      supabase.from("marketing_records").select("id,title").eq("customer_id", customerId),
    );
    rentalQueries.push(
      supabase.from("rental_websites").select("id,name,url").eq("customer_id", customerId),
    );
  } else {
    if (customerEmail) {
      projectQueries.push(
        supabase.from("project_notes").select("id,title").ilike("customer_email", customerEmail),
      );
      hostingQueries.push(
        supabase.from("hosting_records").select("id,provider,client_name").ilike("customer_email", customerEmail),
      );
      marketingQueries.push(
        supabase.from("marketing_records").select("id,title").ilike("customer_email", customerEmail),
      );
      rentalQueries.push(
        supabase.from("rental_websites").select("id,name,url").ilike("customer_email", customerEmail),
      );
    }
    if (nameFilter) {
      projectQueries.push(
        supabase.from("project_notes").select("id,title").ilike("client_name", nameFilter),
      );
      hostingQueries.push(
        supabase.from("hosting_records").select("id,provider,client_name").ilike("client_name", nameFilter),
      );
      marketingQueries.push(
        supabase.from("marketing_records").select("id,title").ilike("client_name", nameFilter),
      );
      rentalQueries.push(
        supabase.from("rental_websites").select("id,name,url").ilike("client_name", nameFilter),
      );
    }
  }

  const [projectResults, hostingResults, marketingResults, rentalResults] = await Promise.all([
    Promise.all(projectQueries),
    Promise.all(hostingQueries),
    Promise.all(marketingQueries),
    Promise.all(rentalQueries),
  ]);

  const projects = projectResults.flatMap((r) => r.data || []);
  const hosting = hostingResults.flatMap((r) => r.data || []);
  const marketing = marketingResults.flatMap((r) => r.data || []);
  const rentals = rentalResults.flatMap((r) => r.data || []);

  return {
    project: dedupeLabels(
      projects.map((p) => ({
        id: p.id,
        label: (p as { title: string }).title,
      })),
    ),
    hosting: dedupeLabels(
      hosting.map((h) => ({
        id: h.id,
        label:
          (h as { provider?: string; client_name?: string }).provider ||
          (h as { client_name?: string }).client_name ||
          h.id.slice(0, 8),
      })),
    ),
    marketing: dedupeLabels(
      marketing.map((m) => ({
        id: m.id,
        label: (m as { title: string }).title,
      })),
    ),
    rental: dedupeLabels(
      rentals.map((r) => ({
        id: r.id,
        label:
          (r as { name?: string; url?: string }).name ||
          (r as { url?: string }).url ||
          r.id.slice(0, 8),
      })),
    ),
  };
}
