import type { TimelineEvent } from "@/components/admin/CustomerTimeline";

export const TIMELINE_CATEGORY_LABELS: Record<
  NonNullable<TimelineEvent["category"]>,
  string
> = {
  lead: "Lead",
  project: "Projekt",
  rental: "Prenájom",
  finance: "Financie",
  communication: "Komunikácia",
  other: "Ostatné",
};

/** Lead statuses that auto-send customer email (see STATUS_CONFIG.sendsEmail). */
export const EMAIL_TRIGGER_LEAD_STATUSES = new Set([
  "send_offer",
  "reminder",
  "send_instructions",
  "order",
]);

/** Stable descending sort: newest first, then id for ties. */
export function sortTimelineEvents(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => {
    const at = new Date(a.at).getTime();
    const bt = new Date(b.at).getTime();
    if (bt !== at) return bt - at;
    return b.id.localeCompare(a.id);
  });
}

/** Remove duplicate event ids (last write wins before sort). */
export function dedupeTimelineEvents(events: TimelineEvent[]): TimelineEvent[] {
  const map = new Map<string, TimelineEvent>();
  for (const event of events) {
    map.set(event.id, event);
  }
  return Array.from(map.values());
}

/**
 * Skip commission timeline rows already represented by a linked project/rental/hosting event.
 * Prevents duplicate noise when entity detail and commission both surface the same work.
 */
export function dedupeLinkedCommissionEvents(events: TimelineEvent[]): TimelineEvent[] {
  const entityKeys = new Set<string>();
  for (const e of events) {
    if (e.category === "project" && e.id.startsWith("project-")) {
      entityKeys.add(`project:${e.id.slice("project-".length)}`);
    }
    if (e.category === "rental" && e.id.startsWith("rental-")) {
      entityKeys.add(`rental:${e.id.slice("rental-".length)}`);
    }
  }

  return events.filter((e) => {
    if (!e.id.startsWith("comm-")) return true;
    const meta = e.meta;
    if (!meta?.source_type || !meta?.source_id) return true;
    const key = `${meta.source_type}:${meta.source_id}`;
    return !entityKeys.has(key);
  });
}

/**
 * When a communication_event references source_table+source_id, hide duplicate legacy rows.
 */
export function dedupeCommunicationSourceOverlaps(events: TimelineEvent[]): TimelineEvent[] {
  const commKeys = new Set<string>();
  for (const e of events) {
    if (!e.id.startsWith("comm-event-")) continue;
    const st = e.meta?.source_table;
    const sid = e.meta?.source_id;
    if (st && sid) commKeys.add(`${st}:${sid}`);
  }
  if (commKeys.size === 0) return events;

  const legacyKey = (e: TimelineEvent): string | null => {
    if (e.id.startsWith("project-")) return `project_notes:${e.id.slice("project-".length)}`;
    if (e.id.startsWith("rental-")) return `rental_websites:${e.id.slice("rental-".length)}`;
    if (e.id.startsWith("comm-")) return `commissions:${e.id.slice("comm-".length)}`;
    return null;
  };

  return events.filter((e) => {
    if (e.id.startsWith("comm-event-")) return true;
    const key = legacyKey(e);
    return !key || !commKeys.has(key);
  });
}

/**
 * Hide lead_log status rows when email_out comm event exists for the same lead.
 * Status change is still visible in /admin/logs; timeline prefers the email record.
 */
export function dedupeEmailTriggeredStatusLogs(events: TimelineEvent[]): TimelineEvent[] {
  const emailedLeadIds = new Set<string>();
  for (const e of events) {
    if (!e.id.startsWith("comm-event-")) continue;
    if (e.meta?.communication_kind !== "email_out") continue;
    if (e.meta.source_table === "leads" && e.meta.source_id) {
      emailedLeadIds.add(e.meta.source_id);
    }
  }
  if (emailedLeadIds.size === 0) return events;

  return events.filter((e) => {
    if (!e.id.startsWith("log-")) return true;
    const leadId = e.meta?.lead_id;
    const field = e.meta?.log_field;
    const newValue = e.meta?.log_new_value;
    if (!leadId || field !== "status" || !newValue) return true;
    if (!EMAIL_TRIGGER_LEAD_STATUSES.has(newValue)) return true;
    return !emailedLeadIds.has(leadId);
  });
}

export function prepareTimelineEvents(
  events: TimelineEvent[],
  limit = 12,
): TimelineEvent[] {
  return sortTimelineEvents(
    dedupeEmailTriggeredStatusLogs(
      dedupeCommunicationSourceOverlaps(
        dedupeLinkedCommissionEvents(dedupeTimelineEvents(events)),
      ),
    ),
  ).slice(0, limit);
}
