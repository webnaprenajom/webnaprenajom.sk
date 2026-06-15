import { supabase } from "@/integrations/supabase/client";
import { findCustomerById } from "@/lib/crmLookup/customers";
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
  let resolvedEmail = input.routeMode === "email" ? input.routeValue : "";
  let canonicalCustomer: CustomerRow | null = null;
  const viewMode = input.routeMode;

  if (input.routeMode === "id") {
    const cust = await findCustomerById(input.routeValue);
    canonicalCustomer = cust;
    customerId = cust?.id ?? input.routeValue;
    resolvedEmail = cust?.email ?? "";
  } else {
    const { data: custRow } = await supabase
      .from("customers")
      .select("id,email,display_name,metadata,created_at,updated_at,active")
      .eq("email", input.routeValue)
      .maybeSingle();
    if (custRow) {
      canonicalCustomer = custRow as CustomerRow;
      customerId = custRow.id;
    }
  }

  const leadFilter =
    customerId && resolvedEmail
      ? `customer_id.eq.${customerId},email.ilike.${resolvedEmail}`
      : customerId
        ? `customer_id.eq.${customerId}`
        : null;

  return { customerId, resolvedEmail, canonicalCustomer, viewMode, leadFilter };
}
