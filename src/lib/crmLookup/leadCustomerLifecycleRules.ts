import type { LeadStatus } from "@/components/admin/leads/constants";
import { normalizeEmail } from "@/lib/crmLookup/normalizeIdentity";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isCustomerUuid(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  return UUID_RE.test(value.trim());
}

/** Statuses that represent a realized / won business relationship. */
export const LEAD_CUSTOMER_PROMOTION_STATUSES: readonly LeadStatus[] = ["won", "order"];

export type LeadCustomerLinkReason =
  | "already_linked"
  | "status_not_won"
  | "no_strong_email"
  | "found_existing"
  | "created_customer"
  | "ensure_failed"
  | "update_failed"
  | "promoted";

export function shouldPromoteLeadToCustomer(status: string): boolean {
  return (LEAD_CUSTOMER_PROMOTION_STATUSES as readonly string[]).includes(status);
}

export function hasStrongCustomerIdentity(input: {
  email?: string | null;
  customer_id?: string | null;
}): boolean {
  if (input.customer_id && isCustomerUuid(input.customer_id)) return true;
  return !!normalizeEmail(input.email);
}

export function leadCustomerLinkLabel(reason: LeadCustomerLinkReason | "lead_only"): string {
  switch (reason) {
    case "already_linked":
    case "found_existing":
    case "created_customer":
    case "promoted":
      return "Lead prepojený na klienta";
    default:
      return "Lead";
  }
}
