/**
 * Unified customer resolution for create/save forms (Batch RC3).
 */

import { supabase } from "@/integrations/supabase/client";
import {
  isCanonicalCustomerId,
  resolveCustomerLinkFields,
  type CustomerLinkFields,
} from "@/lib/crmLookup/customers";
import { normalizeClientName, normalizeEmail } from "@/lib/crmLookup/normalizeIdentity";
import { adminDebugLog } from "@/lib/admin/adminDebugLog";
import { validateFormEmail } from "@/lib/crmLookup/entitySaveHelpers";

export { validateFormEmail, parseInsertRowId, isValidEntityId } from "@/lib/crmLookup/entitySaveHelpers";

export type FormCustomerLinkInput = {
  customer_id?: string | null;
  customer_email?: string | null;
  client_name?: string | null;
  lead_id?: string | null;
  createIfMissing?: boolean;
};

export type FormCustomerLinkResult = CustomerLinkFields & {
  lead_id: string | null;
  warnings: string[];
};

async function enrichFromLead(leadId: string): Promise<{
  email: string | null;
  name: string | null;
  customer_id: string | null;
} | null> {
  const { data, error } = await supabase
    .from("leads")
    .select("id,email,name,customer_id")
    .eq("id", leadId)
    .maybeSingle();
  if (error || !data) {
    adminDebugLog("formCustomerLink", "lead lookup failed", { leadId, error: error?.message });
    return null;
  }
  return {
    email: normalizeEmail(data.email),
    name: normalizeClientName(data.name),
    customer_id:
      data.customer_id && isCanonicalCustomerId(data.customer_id) ? data.customer_id : null,
  };
}

export async function resolveFormCustomerLink(
  input: FormCustomerLinkInput,
): Promise<FormCustomerLinkResult> {
  const warnings: string[] = [];
  let customerId = input.customer_id && isCanonicalCustomerId(input.customer_id) ? input.customer_id : null;
  let clientName = normalizeClientName(input.client_name) || input.client_name?.trim() || "";
  let emailRaw = input.customer_email?.trim() || "";

  const emailCheck = validateFormEmail(emailRaw);
  if (!emailCheck.valid) {
    throw new Error(emailCheck.error ?? "Neplatný e-mail klienta.");
  }

  const leadId = input.lead_id?.trim() || null;
  if (leadId) {
    const lead = await enrichFromLead(leadId);
    if (!lead) {
      warnings.push("Lead sa nepodarilo načítať — uloží sa bez lead prepojenia.");
    } else {
      if (!clientName && lead.name) clientName = lead.name;
      if (!emailCheck.normalized && lead.email) emailRaw = lead.email;
      if (!customerId && lead.customer_id) customerId = lead.customer_id;
    }
  }

  const linked = await resolveCustomerLinkFields({
    customer_id: customerId,
    customer_email: emailRaw || null,
    client_name: clientName,
    createIfMissing: input.createIfMissing ?? false,
  });

  adminDebugLog("formCustomerLink", "resolved", {
    customer_id: linked.customer_id,
    customer_email: linked.customer_email,
    lead_id: leadId,
    warnings,
  });

  return {
    ...linked,
    client_name: linked.client_name || clientName,
    lead_id: leadId,
    warnings,
  };
}
