import { findCustomerByEmail, findCustomerById } from "@/lib/crmLookup/customers";
import { normalizeEmail } from "@/lib/crmLookup/normalizeIdentity";
import type { CustomerRow } from "@/lib/crmLookup/customers";
import type { LoadCustomerWorkbenchInput } from "./loadCustomerWorkbench";

export type ResolvedCustomerIdentity = {
  customerId: string | null;
  resolvedEmail: string;
  canonicalCustomer: CustomerRow | null;
  viewMode: "id" | "email";
  leadFilter: string | null;
};

export async function resolveCustomerIdentity(
  input: LoadCustomerWorkbenchInput,
): Promise<ResolvedCustomerIdentity> {
  let customerId: string | null = null;
  let resolvedEmail = "";
  let canonicalCustomer: CustomerRow | null = null;
  const viewMode = input.routeMode;

  if (input.routeMode === "id") {
    const cust = await findCustomerById(input.routeValue);
    canonicalCustomer = cust;
    customerId = cust?.id ?? null;
    resolvedEmail = normalizeEmail(cust?.email) ?? "";
  } else {
    resolvedEmail = normalizeEmail(input.routeValue) ?? "";
    const cust = await findCustomerByEmail(input.routeValue);
    if (cust) {
      canonicalCustomer = cust;
      customerId = cust.id;
      resolvedEmail = normalizeEmail(cust.email) ?? resolvedEmail;
    }
  }

  const leadFilter =
    customerId && resolvedEmail
      ? `customer_id.eq.${customerId},email.ilike.${resolvedEmail}`
      : customerId
        ? `customer_id.eq.${customerId}`
        : resolvedEmail
          ? `email.ilike.${resolvedEmail}`
          : null;

  return { customerId, resolvedEmail, canonicalCustomer, viewMode, leadFilter };
}
