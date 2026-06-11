import { describe, it, expect } from "vitest";
import {
  normalizeEmail,
  normalizeClientName,
  clientNameCompareKey,
  clientNamesMatch,
  collapseWhitespace,
} from "@/lib/crmLookup/normalizeIdentity";
import {
  sanitizeCommissionSourceFields,
  validateCommissionSourceFields,
  getCommissionLinkStatus,
} from "@/lib/commissionSource";
import {
  dedupeLinkedCommissionEvents,
  prepareTimelineEvents,
  sortTimelineEvents,
} from "@/lib/crmLookup/timeline";
import type { TimelineEvent } from "@/components/admin/CustomerTimeline";

describe("normalizeIdentity", () => {
  it("normalizes email case and whitespace", () => {
    expect(normalizeEmail("  Foo@Bar.COM  ")).toBe("foo@bar.com");
    expect(normalizeEmail("not-an-email")).toBeNull();
  });

  it("collapses client name whitespace", () => {
    expect(normalizeClientName("  ACME   s.r.o.  ")).toBe("ACME s.r.o.");
    expect(clientNameCompareKey("Acme  s.r.o.")).toBe("acme s.r.o.");
    expect(clientNamesMatch("Acme s.r.o.", "  acme   s.r.o.  ")).toBe(true);
  });

  it("collapseWhitespace handles tabs and newlines", () => {
    expect(collapseWhitespace("a\t\n  b")).toBe("a b");
  });
});

describe("commissionSource linking", () => {
  it("sanitizes partial pairs to null", () => {
    expect(sanitizeCommissionSourceFields("project", "")).toEqual({
      source_type: null,
      source_id: null,
    });
    expect(sanitizeCommissionSourceFields("", "uuid")).toEqual({
      source_type: null,
      source_id: null,
    });
  });

  it("keeps valid entity links", () => {
    expect(sanitizeCommissionSourceFields("hosting", "abc-123")).toEqual({
      source_type: "hosting",
      source_id: "abc-123",
    });
  });

  it("maps other type without id", () => {
    expect(sanitizeCommissionSourceFields("other", "ignored")).toEqual({
      source_type: "other",
      source_id: null,
    });
  });

  it("validates missing entity for typed source", () => {
    const result = validateCommissionSourceFields("project", "");
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("detects link status", () => {
    expect(getCommissionLinkStatus({ source_type: null, source_id: null })).toBe("legacy");
    expect(getCommissionLinkStatus({ source_type: "project", source_id: "x" })).toBe("linked");
    expect(getCommissionLinkStatus({ source_type: "project", source_id: null })).toBe("partial");
  });
});

describe("timeline helpers", () => {
  const base: TimelineEvent[] = [
    { id: "project-1", at: "2026-01-01", label: "Projekt", category: "project" },
    {
      id: "comm-9",
      at: "2026-01-02",
      label: "Provízia",
      category: "finance",
      meta: { source_type: "project", source_id: "1" },
    },
    { id: "log-1", at: "2026-01-03", label: "Lead log", category: "lead" },
  ];

  it("dedupes commission when project already in timeline", () => {
    const filtered = dedupeLinkedCommissionEvents(base);
    expect(filtered.some((e) => e.id === "comm-9")).toBe(false);
    expect(filtered.some((e) => e.id === "project-1")).toBe(true);
  });

  it("sorts deterministically by date then id", () => {
    const events: TimelineEvent[] = [
      { id: "b", at: "2026-01-01T12:00:00", label: "B" },
      { id: "a", at: "2026-01-01T12:00:00", label: "A" },
      { id: "c", at: "2026-01-02", label: "C" },
    ];
    const sorted = sortTimelineEvents(events);
    expect(sorted.map((e) => e.id)).toEqual(["c", "b", "a"]);
  });

  it("prepareTimelineEvents applies dedupe and limit", () => {
    const prepared = prepareTimelineEvents(base, 2);
    expect(prepared.length).toBe(2);
    expect(prepared[0].id).toBe("log-1");
  });
});
