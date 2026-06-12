import { resolveCustomerLinkFields } from "@/lib/crmLookup/customers";
import type { CustomerWorkbenchContext } from "./types";

/** Consistent customer_id / customer_email / client_name for workbench quick-create. */
export async function resolveWorkbenchCustomerLink(ctx: CustomerWorkbenchContext) {
  return resolveCustomerLinkFields({
    customer_id: ctx.resolvedCustomerId,
    customer_email: ctx.emailKey || null,
    client_name: ctx.clientName,
    createIfMissing: !!ctx.emailKey,
  });
}
