import { supabase } from "@/integrations/supabase/client";
import { normalizeClientName, normalizeEmail } from "@/lib/crmLookup/normalizeIdentity";
import { validateFormEmail } from "@/lib/crmLookup/entitySaveHelpers";
import type { CustomerRow } from "@/lib/crmLookup/customers";
import { findCustomerById } from "@/lib/crmLookup/customers";

export type CustomerProfileMetadata = {
  phone?: string;
  company?: string;
  contact_person?: string;
  billing_name?: string;
  billing_address?: string;
  address?: string;
  ico?: string;
  dic?: string;
  ic_dph?: string;
  notes?: string;
};

export type CustomerProfileForm = {
  displayName: string;
  email: string;
  phone: string;
  company: string;
  contactPerson: string;
  billingName: string;
  billingAddress: string;
  address: string;
  ico: string;
  dic: string;
  icDph: string;
  notes: string;
};

const trimOrEmpty = (v: string) => v.trim();

const metaString = (metadata: unknown, key: keyof CustomerProfileMetadata): string => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  const v = (metadata as Record<string, unknown>)[key];
  return typeof v === "string" ? v.trim() : "";
};

/** Read one metadata field from a customer row. */
export function metaStringFromCustomer(
  metadata: unknown,
  key: keyof CustomerProfileMetadata,
): string {
  return metaString(metadata, key);
}

export function customerProfileFromRow(
  row: CustomerRow,
  fallbackPhone?: string | null,
): CustomerProfileForm {
  const metadata = row.metadata;
  return {
    displayName: row.display_name ?? "",
    email: row.email ?? "",
    phone: metaString(metadata, "phone") || fallbackPhone?.trim() || "",
    company: metaString(metadata, "company"),
    contactPerson: metaString(metadata, "contact_person"),
    billingName: metaString(metadata, "billing_name"),
    billingAddress: metaString(metadata, "billing_address"),
    address: metaString(metadata, "address"),
    ico: metaString(metadata, "ico"),
    dic: metaString(metadata, "dic"),
    icDph: metaString(metadata, "ic_dph"),
    notes: metaString(metadata, "notes"),
  };
}

export function normalizeCustomerProfileForm(form: CustomerProfileForm): CustomerProfileForm {
  return {
    displayName: normalizeClientName(form.displayName) || trimOrEmpty(form.displayName),
    email: trimOrEmpty(form.email),
    phone: trimOrEmpty(form.phone),
    company: trimOrEmpty(form.company),
    contactPerson: trimOrEmpty(form.contactPerson),
    billingName: trimOrEmpty(form.billingName),
    billingAddress: trimOrEmpty(form.billingAddress),
    address: trimOrEmpty(form.address),
    ico: trimOrEmpty(form.ico),
    dic: trimOrEmpty(form.dic),
    icDph: trimOrEmpty(form.icDph),
    notes: trimOrEmpty(form.notes),
  };
}

export function validateCustomerProfileForm(
  form: CustomerProfileForm,
): { ok: true; normalized: CustomerProfileForm; email: string | null } | { ok: false; error: string } {
  const normalized = normalizeCustomerProfileForm(form);
  if (!normalized.displayName) {
    return { ok: false, error: "Názov klienta je povinný." };
  }

  let email: string | null = null;
  if (normalized.email) {
    const emailCheck = validateFormEmail(normalized.email);
    if (!emailCheck.valid) {
      return { ok: false, error: emailCheck.message ?? "Neplatný e-mail." };
    }
    email = emailCheck.normalized ?? normalizeEmail(normalized.email);
  }

  return { ok: true, normalized, email };
}

function buildMetadataPatch(
  existing: Record<string, unknown> | null | undefined,
  normalized: CustomerProfileForm,
): Record<string, unknown> {
  const base = existing && typeof existing === "object" && !Array.isArray(existing) ? { ...existing } : {};
  const set = (key: keyof CustomerProfileMetadata, value: string) => {
    if (value) base[key] = value;
    else delete base[key];
  };
  set("phone", normalized.phone);
  set("company", normalized.company);
  set("contact_person", normalized.contactPerson);
  set("billing_name", normalized.billingName);
  set("billing_address", normalized.billingAddress);
  set("address", normalized.address);
  set("ico", normalized.ico);
  set("dic", normalized.dic);
  set("ic_dph", normalized.icDph);
  set("notes", normalized.notes);
  return base;
}

export async function updateCustomerProfile(
  customerId: string,
  form: CustomerProfileForm,
): Promise<{ ok: true; row: CustomerRow } | { ok: false; error: string }> {
  const validated = validateCustomerProfileForm(form);
  if (!validated.ok) return validated;

  const existing = await findCustomerById(customerId);
  if (!existing) return { ok: false, error: "Klient sa nenašiel." };

  const metadata = buildMetadataPatch(
    existing.metadata as Record<string, unknown> | undefined,
    validated.normalized,
  );

  const { data, error } = await supabase
    .from("customers")
    .update({
      display_name: validated.normalized.displayName,
      email: validated.email,
      metadata,
    })
    .eq("id", customerId)
    .select("id,email,display_name,metadata,created_at,updated_at")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "E-mail už používa iný klient." };
    }
    return { ok: false, error: error.message };
  }
  if (!data) return { ok: false, error: "Uloženie zlyhalo — skontrolujte oprávnenia." };

  return { ok: true, row: data as CustomerRow };
}
