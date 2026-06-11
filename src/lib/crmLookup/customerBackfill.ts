/**
 * Batch F1 backfill planning — pure logic for review scripts and tests.
 * Does not mutate data; classifies how records would be linked.
 */

import { clientNameCompareKey, normalizeEmail } from "./normalizeIdentity";

export type BackfillOutcome = "auto_linked" | "review_needed" | "unmatched";

export interface BackfillRecordRef {
  table: string;
  id: string;
  email?: string | null;
  client_name?: string | null;
}

export interface BackfillPlanItem extends BackfillRecordRef {
  outcome: BackfillOutcome;
  reason: string;
  proposed_customer_id?: string;
  proposed_email?: string;
}

export interface BackfillSummary {
  auto_linked: number;
  review_needed: number;
  unmatched: number;
  items: BackfillPlanItem[];
}

export interface CustomerSeed {
  id: string;
  email: string | null;
  display_name: string;
}

export interface LeadSeed {
  id: string;
  email: string;
  name: string;
  customer_id?: string | null;
}

/** Email-first linking plan for a batch of entity records. */
export function planEmailBackfill(
  records: BackfillRecordRef[],
  customersByEmail: Map<string, CustomerSeed>,
): BackfillPlanItem[] {
  return records.map((rec) => {
    const email = normalizeEmail(rec.email);
    if (!email) {
      return {
        ...rec,
        outcome: "unmatched",
        reason: "Chýba normalizovateľný e-mail",
      };
    }
    const customer = customersByEmail.get(email);
    if (!customer) {
      return {
        ...rec,
        outcome: "review_needed",
        reason: "E-mail bez existujúceho customera — vyžaduje seed",
        proposed_email: email,
      };
    }
    return {
      ...rec,
      outcome: "auto_linked",
      reason: "Presná zhoda e-mailu",
      proposed_customer_id: customer.id,
      proposed_email: email,
    };
  });
}

/**
 * High-confidence name match: exactly one lead with that name AND lead already has customer_id.
 * Never proposes merge when multiple leads share the name.
 */
export function planNameBackfill(
  records: BackfillRecordRef[],
  leads: LeadSeed[],
): BackfillPlanItem[] {
  const leadsByName = new Map<string, LeadSeed[]>();
  for (const lead of leads) {
    const key = clientNameCompareKey(lead.name);
    if (!key) continue;
    const bucket = leadsByName.get(key) ?? [];
    bucket.push(lead);
    leadsByName.set(key, bucket);
  }

  return records.map((rec) => {
    if (rec.email && normalizeEmail(rec.email)) {
      return {
        ...rec,
        outcome: "unmatched",
        reason: "Preskočené — name backfill len pre záznamy bez e-mailu",
      };
    }
    const key = clientNameCompareKey(rec.client_name);
    if (!key) {
      return {
        ...rec,
        outcome: "unmatched",
        reason: "Chýba client_name",
      };
    }
    const matches = leadsByName.get(key) ?? [];
    if (matches.length === 0) {
      return {
        ...rec,
        outcome: "unmatched",
        reason: "Žiadny lead s rovnakým menom",
      };
    }
    if (matches.length > 1) {
      return {
        ...rec,
        outcome: "review_needed",
        reason: `Nejednoznačné meno — ${matches.length} leadov`,
      };
    }
    const lead = matches[0];
    if (!lead.customer_id) {
      return {
        ...rec,
        outcome: "review_needed",
        reason: "Lead nemá customer_id — najprv email backfill",
      };
    }
    return {
      ...rec,
      outcome: "auto_linked",
      reason: "Jediný lead s menom a customer_id",
      proposed_customer_id: lead.customer_id,
    };
  });
}

export function summarizeBackfill(items: BackfillPlanItem[]): BackfillSummary {
  const summary: BackfillSummary = {
    auto_linked: 0,
    review_needed: 0,
    unmatched: 0,
    items,
  };
  for (const item of items) {
    summary[item.outcome] += 1;
  }
  return summary;
}
