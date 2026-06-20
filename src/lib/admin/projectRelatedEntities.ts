import { normalizeClientName, normalizeEmail } from "@/lib/crmLookup/normalizeIdentity";

export type ProjectRelatedLinkMode = "canonical" | "estimated";

export type ProjectRelatedContext = {
  customer_id: string | null;
  customer_email: string | null;
  client_name: string | null;
};

export type ProjectRelatedQueryPlan = {
  linkMode: ProjectRelatedLinkMode;
  hosting: "customer_id" | "customer_email" | "none";
  rentals: "customer_id" | "client_name" | "none";
  hostingEmail: string | null;
  rentalClientName: string | null;
  customerId: string | null;
};

/** customer_id-first related entity lookups; email/name only when canonical FK is missing. */
export function buildProjectRelatedQueryPlan(ctx: ProjectRelatedContext): ProjectRelatedQueryPlan {
  const customerId = ctx.customer_id?.trim() || null;
  if (customerId) {
    return {
      linkMode: "canonical",
      hosting: "customer_id",
      rentals: "customer_id",
      hostingEmail: null,
      rentalClientName: null,
      customerId,
    };
  }

  return {
    linkMode: "estimated",
    hosting: normalizeEmail(ctx.customer_email) ? "customer_email" : "none",
    rentals: normalizeClientName(ctx.client_name) ? "client_name" : "none",
    hostingEmail: normalizeEmail(ctx.customer_email),
    rentalClientName: normalizeClientName(ctx.client_name),
    customerId: null,
  };
}
