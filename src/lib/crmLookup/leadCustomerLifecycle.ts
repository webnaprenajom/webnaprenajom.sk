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
import { DELIVERY_CUSTOMER_AMBIGUOUS_MSG, validateFormEmail } from "@/lib/crmLookup/entitySaveHelpers";
import { adminDebugLog } from "@/lib/admin/adminDebugLog";
import { normalizeClientName, normalizeEmail } from "@/lib/crmLookup/normalizeIdentity";
import {
  shouldPromoteLeadToCustomer,
  shouldRequireLeadCustomer,
  type LeadCustomerLinkReason,
} from "@/lib/crmLookup/leadCustomerLifecycleRules";

export {
  LEAD_CUSTOMER_PROMOTION_STATUSES,
  LEAD_CUSTOMER_REQUIRED_STATUSES,
  shouldPromoteLeadToCustomer,
  shouldRequireLeadCustomer,
  hasStrongCustomerIdentity,
  leadCustomerLinkLabel,
  type LeadCustomerLinkReason,
} from "@/lib/crmLookup/leadCustomerLifecycleRules";

export const LEAD_CUSTOMER_REQUIRED_MSG =
  "Lead v stave Dohodnutý/Zrealizovaný musí mať priradeného klienta alebo platný e-mail.";

export type LeadCustomerPreSaveResult =
  | { ok: true }
  | { ok: false; message: string; field: "customer" };

export type LeadCustomerPrepareResult =
  | { ok: true; customer_id: string | null; created: boolean }
  | { ok: false; message: string; field: "customer" };

/** Sync pre-save guard — no Supabase. */
export function validateLeadCustomerBeforeSave(input: {
  status: string;
  customer_id?: string | null;
  email?: string | null;
}): LeadCustomerPreSaveResult {
  if (!shouldRequireLeadCustomer(input.status)) {
    return { ok: true };
  }
  if (isCanonicalCustomerId(input.customer_id)) {
    return { ok: true };
  }
  const emailCheck = validateFormEmail(input.email);
  if (emailCheck.valid && emailCheck.normalized) {
    return { ok: true };
  }
  return { ok: false, message: LEAD_CUSTOMER_REQUIRED_MSG, field: "customer" };
}

/** Resolve/create customer for required statuses — does not update the lead row. */
async function resolvePromotionCustomerRecord(input: {
  email: string;
  name: string;
}): Promise<
  | { ok: true; customer_id: string; created: boolean }
  | { ok: false; message: string; field: "customer" }
> {
  const email = normalizeEmail(input.email);
  if (!email) {
    return { ok: false, message: LEAD_CUSTOMER_REQUIRED_MSG, field: "customer" };
  }

  const displayName = normalizeClientName(input.name) || input.name.trim() || email.split("@")[0];
  const existing = await findCustomerByEmail(email);
  if (existing) {
    return { ok: true, customer_id: existing.id, created: false };
  }

  const ensured = await ensureCustomerByEmail(email, displayName, { allowReviewCreate: true });
  if (ensured.blocked || !ensured.row) {
    return { ok: false, message: DELIVERY_CUSTOMER_AMBIGUOUS_MSG, field: "customer" };
  }

  return { ok: true, customer_id: ensured.row.id, created: true };
}

/** Async pre-save prepare — returns customer_id for caller's DB write (no lead update here). */
export async function prepareLeadCustomerForSave(input: {
  leadId?: string;
  status: string;
  email: string;
  name: string;
  customer_id?: string | null;
}): Promise<LeadCustomerPrepareResult> {
  const sync = validateLeadCustomerBeforeSave({
    status: input.status,
    customer_id: input.customer_id,
    email: input.email,
  });
  if (!sync.ok) {
    return sync;
  }

  if (isCanonicalCustomerId(input.customer_id)) {
    return { ok: true, customer_id: input.customer_id!, created: false };
  }

  if (shouldRequireLeadCustomer(input.status)) {
    const emailCheck = validateFormEmail(input.email);
    if (emailCheck.valid && emailCheck.normalized) {
      const resolved = await resolvePromotionCustomerRecord({
        email: input.email,
        name: input.name,
      });
      if (!resolved.ok) {
        return resolved;
      }
      return {
        ok: true,
        customer_id: resolved.customer_id,
        created: resolved.created,
      };
    }
  }

  return { ok: true, customer_id: null, created: false };
}

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
