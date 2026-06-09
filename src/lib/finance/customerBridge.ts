/** Customer identity bridge — compatibility layer, not canonical customer entity. */

export type CustomerConfidence = "high" | "medium" | "low";

export interface CustomerIdentity {
  canonicalKey: string;
  confidence: CustomerConfidence;
  displayName: string;
  email: string | null;
  clientName: string | null;
  rentalWebsiteId: string | null;
  sourceBasis: string;
}

function normEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  return e.includes("@") ? e : null;
}

function normName(name: string | null | undefined): string | null {
  if (!name) return null;
  const n = name.trim().toLowerCase().replace(/\s+/g, " ");
  return n.length > 0 ? n : null;
}

/** Stable key for grouping — email preferred, then name, then website id. */
export function normalizeCustomerKey(input: {
  customerEmail?: string | null;
  clientName?: string | null;
  rentalWebsiteId?: string | null;
}): string {
  const email = normEmail(input.customerEmail);
  if (email) return `email:${email}`;
  const name = normName(input.clientName);
  if (name) return `name:${name}`;
  if (input.rentalWebsiteId) return `website:${input.rentalWebsiteId}`;
  return "unknown";
}

export function resolveCustomerIdentity(input: {
  customerEmail?: string | null;
  clientName?: string | null;
  rentalWebsiteId?: string | null;
}): CustomerIdentity {
  const email = normEmail(input.customerEmail);
  const clientName = input.clientName?.trim() || null;
  const rentalWebsiteId = input.rentalWebsiteId ?? null;

  if (email) {
    return {
      canonicalKey: `email:${email}`,
      confidence: "high",
      displayName: clientName ?? email,
      email,
      clientName,
      rentalWebsiteId,
      sourceBasis: "customer_email",
    };
  }

  if (clientName) {
    return {
      canonicalKey: `name:${normName(clientName)}`,
      confidence: "medium",
      displayName: clientName,
      email: null,
      clientName,
      rentalWebsiteId,
      sourceBasis: "client_name",
    };
  }

  if (rentalWebsiteId) {
    return {
      canonicalKey: `website:${rentalWebsiteId}`,
      confidence: "low",
      displayName: `Website ${rentalWebsiteId.slice(0, 8)}`,
      email: null,
      clientName: null,
      rentalWebsiteId,
      sourceBasis: "rental_website_id",
    };
  }

  return {
    canonicalKey: "unknown",
    confidence: "low",
    displayName: "Neidentifikovaný klient",
    email: null,
    clientName: null,
    rentalWebsiteId: null,
    sourceBasis: "none",
  };
}

export function customerDisplayLabel(identity: CustomerIdentity): string {
  if (identity.confidence === "low" && identity.sourceBasis === "none") {
    return identity.displayName;
  }
  const conf = identity.confidence === "high" ? "" : ` (${identity.confidence})`;
  return `${identity.displayName}${conf}`;
}
