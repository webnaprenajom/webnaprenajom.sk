/**
 * Reconcile email-only communication_events to canonical customers (Batch G.5).
 * Preserves event ids and audit fields — only updates customer_id / customer_email.
 */

import { supabase } from "@/integrations/supabase/client";
import { findCustomerById } from "@/lib/crmLookup/customers";
import { normalizeEmail } from "@/lib/crmLookup/normalizeIdentity";

export interface ReconcileResult {
  ok: boolean;
  updated: number;
  error?: string;
}

/** Link specific events to a customer by UUID. */
export async function reconcileCommunicationEventsToCustomer(
  eventIds: string[],
  customerId: string,
): Promise<ReconcileResult> {
  if (!eventIds.length) return { ok: true, updated: 0 };

  const customer = await findCustomerById(customerId);
  if (!customer) {
    return { ok: false, updated: 0, error: "Zákazník neexistuje" };
  }

  const { data, error } = await supabase
    .from("communication_events")
    .update({
      customer_id: customer.id,
      customer_email: customer.email ?? undefined,
    })
    .in("id", eventIds)
    .is("customer_id", null)
    .select("id");

  if (error) {
    return { ok: false, updated: 0, error: error.message };
  }

  return { ok: true, updated: data?.length ?? 0 };
}

/** Bulk link all unlinked events matching sender/customer email to a customer. */
export async function reconcileCommunicationEventsByEmail(
  customerId: string,
  email: string,
): Promise<ReconcileResult> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return { ok: false, updated: 0, error: "Neplatný e-mail" };
  }

  const customer = await findCustomerById(customerId);
  if (!customer) {
    return { ok: false, updated: 0, error: "Zákazník neexistuje" };
  }

  const { data, error } = await supabase
    .from("communication_events")
    .update({
      customer_id: customer.id,
      customer_email: customer.email ?? normalized,
    })
    .eq("kind", "email_in")
    .is("customer_id", null)
    .or(`sender_email.eq.${normalized},customer_email.eq.${normalized}`)
    .select("id");

  if (error) {
    return { ok: false, updated: 0, error: error.message };
  }

  return { ok: true, updated: data?.length ?? 0 };
}
