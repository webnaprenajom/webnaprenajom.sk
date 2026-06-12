/**
 * Golden-record identity rules (Batch RC5) — pure, test-safe.
 */

import { clientNameCompareKey, normalizeEmail, normalizeClientName } from "./normalizeIdentity";
import { isCanonicalCustomerId } from "./entityIds";

export type IdentityMatchLevel =
  | "customer_id"
  | "email"
  | "manual"
  | "name_heuristic"
  | "none";

export type CustomerIdentityInput = {
  customer_id?: string | null;
  customer_email?: string | null;
  client_name?: string | null;
  /** Explicit manual link from picker / approved operator action. */
  manual_link?: boolean;
};

export type CustomerCreateRisk =
  | "link_existing"
  | "safe_create"
  | "review_needed"
  | "blocked_ambiguous";

export type CustomerRecordLite = {
  id: string;
  email: string | null;
  display_name: string;
  created_at?: string;
};

export type DuplicateCandidate = {
  primaryId: string;
  secondaryId: string;
  reason: string;
  confidence: "high" | "medium" | "low";
  /** Which record should survive in a future merge. */
  canonicalId: string;
};

/** Canonical precedence: customer_id → email → manual → limited name heuristic. */
export function resolveIdentityMatchLevel(input: CustomerIdentityInput): IdentityMatchLevel {
  if (input.customer_id && isCanonicalCustomerId(input.customer_id)) return "customer_id";
  if (normalizeEmail(input.customer_email)) return "email";
  if (input.manual_link) return "manual";
  const nameKey = clientNameCompareKey(input.client_name);
  if (nameKey) return "name_heuristic";
  return "none";
}

export function identityMatchLabel(level: IdentityMatchLevel): string {
  switch (level) {
    case "customer_id":
      return "Kanónické ID";
    case "email":
      return "E-mail";
    case "manual":
      return "Manuálne prepojenie";
    case "name_heuristic":
      return "Heuristika mena";
    default:
      return "Bez identity";
  }
}

/** Score for merge-survivor selection — higher wins. */
export function customerRecordScore(row: CustomerRecordLite): number {
  let score = 0;
  if (row.email) score += 100;
  if (row.display_name?.trim()) score += 10;
  return score;
}

export function pickCanonicalCustomerRecord(rows: CustomerRecordLite[]): CustomerRecordLite | null {
  if (rows.length === 0) return null;
  return [...rows].sort((a, b) => {
    const scoreDiff = customerRecordScore(b) - customerRecordScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (aTime !== bTime) return aTime - bTime;
    return a.id.localeCompare(b.id);
  })[0];
}

/** Detect likely duplicate customers (same normalized name, different emails). */
export function findDuplicateCustomerCandidates(customers: CustomerRecordLite[]): DuplicateCandidate[] {
  const byName = new Map<string, CustomerRecordLite[]>();
  for (const c of customers) {
    const key = clientNameCompareKey(c.display_name);
    if (!key) continue;
    const bucket = byName.get(key) ?? [];
    bucket.push(c);
    byName.set(key, bucket);
  }

  const out: DuplicateCandidate[] = [];
  for (const [, group] of byName) {
    if (group.length < 2) continue;
    const emails = new Set(group.map((g) => normalizeEmail(g.email)).filter(Boolean));
    if (emails.size <= 1 && group.length > 1) continue;
    const canonical = pickCanonicalCustomerRecord(group)!;
    for (const row of group) {
      if (row.id === canonical.id) continue;
      out.push({
        primaryId: canonical.id,
        secondaryId: row.id,
        reason:
          emails.size > 1
            ? "Rovnaké meno, rôzne e-maily"
            : "Rovnaké meno, viac záznamov bez jednoznačného e-mailu",
        confidence: emails.size > 1 ? "high" : "medium",
        canonicalId: canonical.id,
      });
    }
  }
  return out;
}

/** Assess whether a new customer row should be created vs linked. */
export function assessCustomerCreateRisk(
  input: { email: string; displayName: string },
  existingByEmail: CustomerRecordLite | null,
  existingByName: CustomerRecordLite[],
): { risk: CustomerCreateRisk; message?: string; linkToId?: string } {
  if (existingByEmail) {
    return {
      risk: "link_existing",
      linkToId: existingByEmail.id,
      message: "Zákazník s týmto e-mailom už existuje — použije sa existujúci záznam.",
    };
  }

  const nameMatches = existingByName.filter(
    (c) => clientNameCompareKey(c.display_name) === clientNameCompareKey(input.displayName),
  );
  if (nameMatches.length === 1 && !nameMatches[0].email) {
    return {
      risk: "link_existing",
      linkToId: nameMatches[0].id,
      message: "Nájdený zákazník s rovnakým menom bez e-mailu — prepojí sa namiesto duplicity.",
    };
  }
  if (nameMatches.length > 1) {
    return {
      risk: "blocked_ambiguous",
      message: `Nejednoznačné meno „${input.displayName}“ — ${nameMatches.length} existujúcich záznamov. Vyberte klienta manuálne.`,
    };
  }
  if (nameMatches.length === 1 && nameMatches[0].email && nameMatches[0].email !== normalizeEmail(input.email)) {
    return {
      risk: "review_needed",
      message: "Meno sa zhoduje, e-mail je iný — skontrolujte duplicitu pred vytvorením.",
    };
  }

  return { risk: "safe_create" };
}

/** Merge-readiness: fields to preserve when merging secondary → primary. */
export function mergePriorityFields(primary: CustomerRecordLite, secondary: CustomerRecordLite) {
  return {
    canonicalId: pickCanonicalCustomerRecord([primary, secondary])!.id,
    keepEmail: primary.email || secondary.email,
    keepDisplayName:
      normalizeClientName(primary.display_name)?.length >=
      normalizeClientName(secondary.display_name)?.length
        ? primary.display_name
        : secondary.display_name,
  };
}

export type RentalLinkPlan = {
  rentalId: string;
  outcome: "auto_linked" | "review_needed" | "unmatched";
  reason: string;
  proposedCustomerId?: string;
};

/** High-confidence rental → customer link (single lead with customer_id, exact name). */
export function planRentalCustomerLink(
  rentals: Array<{ id: string; client_name: string | null; customer_id?: string | null }>,
  leads: Array<{ id: string; name: string; customer_id?: string | null }>,
): RentalLinkPlan[] {
  const leadsByName = new Map<string, typeof leads>();
  for (const lead of leads) {
    const key = clientNameCompareKey(lead.name);
    if (!key) continue;
    const bucket = leadsByName.get(key) ?? [];
    bucket.push(lead);
    leadsByName.set(key, bucket);
  }

  return rentals.map((rental) => {
    if (rental.customer_id && isCanonicalCustomerId(rental.customer_id)) {
      return { rentalId: rental.id, outcome: "unmatched", reason: "Už prepojené" };
    }
    const key = clientNameCompareKey(rental.client_name);
    if (!key) {
      return { rentalId: rental.id, outcome: "unmatched", reason: "Chýba client_name" };
    }
    const matches = leadsByName.get(key) ?? [];
    if (matches.length === 0) {
      return { rentalId: rental.id, outcome: "unmatched", reason: "Žiadny lead s rovnakým menom" };
    }
    if (matches.length > 1) {
      return {
        rentalId: rental.id,
        outcome: "review_needed",
        reason: `Nejednoznačné meno — ${matches.length} leadov`,
      };
    }
    const lead = matches[0];
    if (!lead.customer_id || !isCanonicalCustomerId(lead.customer_id)) {
      return {
        rentalId: rental.id,
        outcome: "review_needed",
        reason: "Lead nemá customer_id",
      };
    }
    return {
      rentalId: rental.id,
      outcome: "auto_linked",
      reason: "Jediný lead s menom a customer_id",
      proposedCustomerId: lead.customer_id,
    };
  });
}
