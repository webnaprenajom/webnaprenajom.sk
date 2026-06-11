import { describe, it, expect } from "vitest";
import {
  buildLegacyHealthChecklist,
  legacyHealthSeverity,
  type LegacyHealthCounts,
} from "@/lib/crmLookup/legacyHealthReport";

const sampleCounts = (): LegacyHealthCounts => ({
  legacyCommissions: 3,
  partialCommissions: 1,
  leadsWithoutCustomer: 12,
  unlinkedInboundComm: 5,
  openTasksWithoutCustomer: 8,
  tasksBackfillableViaLead: 2,
});

describe("legacyHealthSeverity", () => {
  it("returns ok for zero counts", () => {
    expect(legacyHealthSeverity(0)).toBe("ok");
  });

  it("returns warn above threshold", () => {
    expect(legacyHealthSeverity(6, 5)).toBe("warn");
    expect(legacyHealthSeverity(4, 5)).toBe("info");
  });
});

describe("buildLegacyHealthChecklist", () => {
  it("includes all RC1 visibility categories", () => {
    const items = buildLegacyHealthChecklist(sampleCounts());
    expect(items.map((i) => i.id)).toEqual([
      "legacyCommissions",
      "partialCommissions",
      "leadsWithoutCustomer",
      "unlinkedInboundComm",
      "openTasksWithoutCustomer",
      "tasksBackfillableViaLead",
    ]);
  });

  it("links commissions issues to finance legacy view", () => {
    const legacy = buildLegacyHealthChecklist(sampleCounts()).find(
      (i) => i.id === "legacyCommissions",
    );
    expect(legacy?.actionHref).toContain("legacy=commissions");
    expect(legacy?.count).toBe(3);
  });

  it("links unlinked comm to communication ops", () => {
    const comm = buildLegacyHealthChecklist(sampleCounts()).find(
      (i) => i.id === "unlinkedInboundComm",
    );
    expect(comm?.actionHref).toBe("/admin/communication-ops");
  });

  it("marks zero counts as ok severity", () => {
    const zero: LegacyHealthCounts = {
      legacyCommissions: 0,
      partialCommissions: 0,
      leadsWithoutCustomer: 0,
      unlinkedInboundComm: 0,
      openTasksWithoutCustomer: 0,
      tasksBackfillableViaLead: 0,
    };
    expect(buildLegacyHealthChecklist(zero).every((i) => i.severity === "ok")).toBe(true);
  });
});
