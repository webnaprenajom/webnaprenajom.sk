/**
 * Lead ↔ customer lifecycle (Batch RC2) — async DB operations.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  ensureCustomerByEmail,
  findCustomerByEmail,
  isCanonicalCustomerId,
  type CustomerRow,
} from "@/lib/crmLookup/customers";
import { adminDebugLog } from "@/lib/admin/adminDebugLog";
import { normalizeClientName, normalizeEmail } from "@/lib/crmLookup/normalizeIdentity";
import {
  shouldPromoteLeadToCustomer,
  type LeadCustomerLinkReason,
} from "@/lib/crmLookup/leadCustomerLifecycleRules";

export {
  LEAD_CUSTOMER_PROMOTION_STATUSES,
  shouldPromoteLeadToCustomer,
  hasStrongCustomerIdentity,
  leadCustomerLinkLabel,
  type LeadCustomerLinkReason,
} from "@/lib/crmLookup/leadCustomerLifecycleRules";

/** Safe lead → customer link when status is won/order and email is valid. */
export async function ensureLeadCustomerLink(input: {
  leadId: string;
  email: string;
  name: string;
  status: string;
  existingCustomerId?: string | null;
}): Promise<{ customer_id: string | null; reason: LeadCustomerLinkReason; customer?: CustomerRow | null }> {
  if (input.existingCustomerId && isCanonicalCustomerId(input.existingCustomerId)) {
    return { customer_id: input.existingCustomerId, reason: "already_linked" };
  }

  if (!shouldPromoteLeadToCustomer(input.status)) {
    return { customer_id: null, reason: "status_not_won" };
  }

  const email = normalizeEmail(input.email);
  if (!email) {
    return { customer_id: null, reason: "no_strong_email" };
  }

  const displayName = normalizeClientName(input.name) || input.name.trim() || email.split("@")[0];
  const existing = await findCustomerByEmail(email);
  const ensured = existing
    ? { row: existing }
    : await ensureCustomerByEmail(email, displayName, { allowReviewCreate: true });
  const customer = ensured.row;

  if (!customer) {
    adminDebugLog("leadLifecycle", "ensureCustomerByEmail failed", { leadId: input.leadId, email });
    return { customer_id: null, reason: "ensure_failed" };
  }

  const { error } = await supabase
    .from("leads")
    .update({ customer_id: customer.id })
    .eq("id", input.leadId)
    .is("customer_id", null);

  if (error) {
    adminDebugLog("leadLifecycle", "lead customer_id update failed", {
      leadId: input.leadId,
      customerId: customer.id,
      message: error.message,
    });
    return { customer_id: customer.id, reason: "update_failed", customer };
  }

  return {
    customer_id: customer.id,
    reason: existing ? "promoted" : "created_customer",
    customer,
  };
}

/** After delivery entity save — propagate customer_id to lead when missing. */
export async function linkLeadAfterDelivery(
  leadId: string | null | undefined,
  customerId: string | null | undefined,
): Promise<boolean> {
  if (!leadId || !customerId || !isCanonicalCustomerId(customerId)) return false;
  const { error } = await supabase
    .from("leads")
    .update({ customer_id: customerId })
    .eq("id", leadId)
    .is("customer_id", null);
  return !error;
}
