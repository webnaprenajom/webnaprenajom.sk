import type { Lead, LeadStatus } from "@/components/admin/leads/constants";
import { ARCHIVE_STATUSES, STALE_DAYS } from "@/components/admin/leads/constants";
import { shouldPromoteLeadToCustomer } from "@/lib/crmLookup/leadCustomerLifecycleRules";

/**
 * Fáza 4 — Pipeline & Leads UX
 *
 * Shared, purely-derived signals computed from data already loaded by Admin.tsx
 * (`leads.*` via `select("*")`). No new queries, no DB changes.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const daysSince = (iso: string): number =>
  Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);

/**
 * "Last activity" timestamp for a lead — falls back to `updated_at` when
 * `status_changed_at` is missing (same fallback as `isStale()` in constants.ts).
 */
export const getLastActivityAt = (lead: Pick<Lead, "status_changed_at" | "updated_at">): string =>
  lead.status_changed_at || lead.updated_at;

/** Days since the lead's last status change / update — computed for ALL leads, any status. */
export const getDaysWithoutContact = (lead: Pick<Lead, "status_changed_at" | "updated_at">): number =>
  daysSince(getLastActivityAt(lead));

/**
 * CLAUDE.md farebná konvencia: zelená <3 dni, oranžová 3-7, červená >7.
 * Returns badge classes in the same `bg-X/15 text-X border-X/30` style used across the admin UI.
 */
export const contactUrgencyClass = (days: number): string => {
  if (days < 3) return "bg-green-500/15 text-green-600 border-green-500/30";
  if (days <= 7) return "bg-orange-500/15 text-orange-600 border-orange-500/30";
  return "bg-red-500/15 text-red-600 border-red-500/30";
};

const todayStr = () => new Date().toISOString().slice(0, 10);

/** Follow-up date is today or in the past, and the lead isn't archived (won/lost). */
export const isFollowUpDueToday = (lead: Pick<Lead, "follow_up_date" | "status">): boolean => {
  if (!lead.follow_up_date) return false;
  if (ARCHIVE_STATUSES.includes(lead.status)) return false;
  return lead.follow_up_date <= todayStr();
};

/** Follow-up date is strictly in the past. */
export const isFollowUpOverdue = (lead: Pick<Lead, "follow_up_date" | "status">): boolean => {
  if (!lead.follow_up_date) return false;
  if (ARCHIVE_STATUSES.includes(lead.status)) return false;
  return lead.follow_up_date < todayStr();
};

/**
 * Broader "stagnuje" signal than `isStale()` — applies to ANY non-archived lead that
 * hasn't had a status/update change in STALE_DAYS, regardless of status.
 *
 * Intentionally overlaps with `isStale()` / the "Bez reakcie" tab: that tab tracks a
 * specific set of "waiting on client" statuses, while this is a general activity-recency
 * signal shown on every lead. A lead can appear in "Aktuálne" and still match this filter.
 */
export const isStagnant = (lead: Lead): boolean => {
  if (ARCHIVE_STATUSES.includes(lead.status)) return false;
  return getDaysWithoutContact(lead) >= STALE_DAYS;
};

export type QuickFilterId =
  | "new"
  | "today_followup"
  | "stagnant"
  | "hot"
  | "missing_customer_link";

export interface QuickFilterDef {
  id: QuickFilterId;
  label: string;
  predicate: (lead: Lead) => boolean;
}

/** Statuses that should already be linked to a customer record (per leadCustomerLifecycleRules). */
const missingCustomerLink = (lead: Lead): boolean =>
  shouldPromoteLeadToCustomer(lead.status) && !lead.customer_id;

export const QUICK_FILTERS: QuickFilterDef[] = [
  { id: "new", label: "Nové", predicate: (l) => l.status === "new" },
  { id: "today_followup", label: "Kontaktovať dnes", predicate: isFollowUpDueToday },
  { id: "stagnant", label: `Stagnujúce ${STALE_DAYS}+ dní`, predicate: isStagnant },
  { id: "hot", label: "Hot 🔥", predicate: (l) => l.temperature === "hot" },
  { id: "missing_customer_link", label: "Chýba prepojenie klienta", predicate: missingCustomerLink },
];

export const SORT_SENTINEL_FUTURE = "9999-12-31";
