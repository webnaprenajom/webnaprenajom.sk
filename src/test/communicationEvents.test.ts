import { describe, it, expect } from "vitest";
import {
  buildEventPreview,
  communicationSourceLabel,
  communicationEventToTimeline,
  filterTimelineCommunicationEvents,
  EDGE_FUNCTION_LABELS,
} from "@/lib/communication/events";
import type { CommunicationEventRow } from "@/lib/communication/types";
import {
  dedupeCommunicationSourceOverlaps,
  dedupeEmailTriggeredStatusLogs,
  prepareTimelineEvents,
} from "@/lib/crmLookup/timeline";
import type { TimelineEvent } from "@/components/admin/CustomerTimeline";

const baseRow = (overrides: Partial<CommunicationEventRow>): CommunicationEventRow => ({
  id: "1",
  customer_id: null,
  customer_email: "a@b.cz",
  kind: "email_out",
  title: "Test",
  body_preview: null,
  metadata: {},
  source_table: null,
  source_id: null,
  occurred_at: "2026-01-01T00:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("communication events helpers", () => {
  it("buildEventPreview truncates long text", () => {
    const long = "a".repeat(300);
    const preview = buildEventPreview(long, 50);
    expect(preview).toHaveLength(50);
    expect(preview?.endsWith("…")).toBe(true);
  });

  it("labels edge function with Slovak label", () => {
    const row = baseRow({
      metadata: { edge_function: "send-reminder-email" },
    });
    expect(communicationSourceLabel(row)).toBe(EDGE_FUNCTION_LABELS["send-reminder-email"]);
  });

  it("email_out timeline uses title without redundant kind prefix", () => {
    const row = baseRow({
      id: "2",
      kind: "email_out",
      title: "Pripomienka – Váš dopyt",
      body_preview: "Preview text",
      metadata: { resend_id: "re_123", edge_function: "send-reminder-email" },
      source_table: "leads",
      source_id: "lead-1",
    });
    const event = communicationEventToTimeline(row);
    expect(event.category).toBe("communication");
    expect(event.label).toBe("Pripomienka – Váš dopyt");
    expect(event.meta?.source_table).toBe("leads");
    expect(event.href).toBe("/admin?lead=lead-1");
  });

  it("note timeline label is distinct from email", () => {
    const row = baseRow({
      kind: "note",
      title: "Interná poznámka",
      body_preview: "Text poznámky",
      metadata: { origin: "admin_customer_note" },
    });
    const event = communicationEventToTimeline(row);
    expect(event.label).toBe("Interná poznámka");
    expect(event.meta?.communication_kind).toBe("note");
  });

  it("filters communication timeline subsets", () => {
    const events = [
      communicationEventToTimeline(baseRow({ id: "in", kind: "email_in" })),
      communicationEventToTimeline(baseRow({ id: "out", kind: "email_out" })),
      {
        id: "log-1",
        at: "2026-01-01T00:00:00Z",
        label: "Lead change",
        category: "lead" as const,
      },
    ];
    expect(filterTimelineCommunicationEvents(events, "inbound")).toHaveLength(1);
    expect(filterTimelineCommunicationEvents(events, "all")).toHaveLength(3);
  });
});

describe("dedupeCommunicationSourceOverlaps", () => {
  it("prefers comm-event over legacy project row with same source", () => {
    const events: TimelineEvent[] = [
      {
        id: "comm-event-99",
        at: "2026-02-01T00:00:00Z",
        label: "Projekt event",
        category: "project",
        meta: { source_table: "project_notes", source_id: "pn-1" },
      },
      {
        id: "project-pn-1",
        at: "2026-02-01T00:00:00Z",
        label: "Projekt · Legacy",
        category: "project",
      },
    ];
    const out = dedupeCommunicationSourceOverlaps(events);
    expect(out.some((e) => e.id === "comm-event-99")).toBe(true);
    expect(out.some((e) => e.id === "project-pn-1")).toBe(false);
  });

  it("prefers comm-event commission over legacy comm row", () => {
    const events: TimelineEvent[] = [
      {
        id: "comm-event-c1",
        at: "2026-02-01T00:00:00Z",
        label: "Provízia · Nová",
        category: "finance",
        meta: { source_table: "commissions", source_id: "c1" },
      },
      {
        id: "comm-c1",
        at: "2026-02-01T00:00:00Z",
        label: "Provízia · Legacy",
        category: "finance",
      },
    ];
    const out = dedupeCommunicationSourceOverlaps(events);
    expect(out.some((e) => e.id === "comm-event-c1")).toBe(true);
    expect(out.some((e) => e.id === "comm-c1")).toBe(false);
  });
});

describe("dedupeEmailTriggeredStatusLogs", () => {
  it("hides status lead_log when email_out exists for same lead", () => {
    const events: TimelineEvent[] = [
      {
        id: "comm-event-mail",
        at: "2026-03-01T10:00:00Z",
        label: "Pripomienka",
        category: "communication",
        meta: {
          communication_kind: "email_out",
          source_table: "leads",
          source_id: "lead-1",
        },
      },
      {
        id: "log-status",
        at: "2026-03-01T10:00:01Z",
        label: "Stav: reminder",
        category: "lead",
        meta: { lead_id: "lead-1", log_field: "status", log_new_value: "reminder" },
      },
      {
        id: "log-other",
        at: "2026-03-01T09:00:00Z",
        label: "Lead vytvorený",
        category: "lead",
        meta: { lead_id: "lead-1", log_field: "status", log_new_value: "new" },
      },
    ];
    const out = dedupeEmailTriggeredStatusLogs(events);
    expect(out.some((e) => e.id === "comm-event-mail")).toBe(true);
    expect(out.some((e) => e.id === "log-status")).toBe(false);
    expect(out.some((e) => e.id === "log-other")).toBe(true);
  });

  it("prepareTimelineEvents applies email status dedupe in pipeline", () => {
    const events: TimelineEvent[] = [
      {
        id: "comm-event-mail",
        at: "2026-03-01T10:00:00Z",
        label: "Ponuka",
        category: "communication",
        meta: {
          communication_kind: "email_out",
          source_table: "leads",
          source_id: "lead-2",
        },
      },
      {
        id: "log-status",
        at: "2026-03-01T10:00:01Z",
        label: "Stav: send_offer",
        category: "lead",
        meta: { lead_id: "lead-2", log_field: "status", log_new_value: "send_offer" },
      },
    ];
    const prepared = prepareTimelineEvents(events, 10);
    expect(prepared).toHaveLength(1);
    expect(prepared[0]?.id).toBe("comm-event-mail");
  });
});
