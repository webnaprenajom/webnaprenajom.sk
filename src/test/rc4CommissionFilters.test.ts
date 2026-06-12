import { describe, it, expect } from "vitest";
import {
  bucketCommissionsBySection,
  filterImplementerCommissions,
  isCommissionForSection,
} from "@/lib/commissionFilters";
import type { CommissionRow } from "@/lib/commissionSource";

const base = (over: Partial<CommissionRow>): CommissionRow => ({
  id: over.id || "1",
  title: over.title || "Test",
  implementer: over.implementer || "Jan",
  amount: over.amount ?? 100,
  payment_status: over.payment_status || "unpaid",
  note: null,
  date: over.date || "2026-06-01",
  ...over,
});

describe("bucketCommissionsBySection", () => {
  it("isolates rental-linked rows from cross-section and legacy", () => {
    const rows = [
      base({ id: "r1", source_type: "rental", source_id: "web-1" }),
      base({ id: "h1", source_type: "hosting", source_id: "host-1" }),
      base({ id: "l1", source_type: null, source_id: null }),
      base({ id: "p1", source_type: "project", source_id: "proj-1" }),
    ];
    const buckets = bucketCommissionsBySection(rows, "rental");
    expect(buckets.section.map((r) => r.id)).toEqual(["r1"]);
    expect(buckets.legacy.map((r) => r.id)).toEqual(["l1"]);
    expect(buckets.crossSection.map((r) => r.id)).toEqual(["h1", "p1"]);
  });
});

describe("filterImplementerCommissions", () => {
  it("filters by implementer, year, and section", () => {
    const rows = [
      base({ id: "a", implementer: "Jan", date: "2026-01-15", source_type: "rental", source_id: "w1" }),
      base({ id: "b", implementer: "Jan", date: "2025-12-01", source_type: "rental", source_id: "w2" }),
      base({ id: "c", implementer: "Eva", date: "2026-02-01", source_type: "rental", source_id: "w3" }),
      base({ id: "d", implementer: "Jan", date: "2026-03-01", source_type: "hosting", source_id: "h1" }),
    ];
    const filtered = filterImplementerCommissions(rows, "Jan", {
      year: 2026,
      section: "rental",
    });
    expect(filtered.map((r) => r.id)).toEqual(["a"]);
  });
});

describe("isCommissionForSection", () => {
  it("requires matching type and id", () => {
    expect(isCommissionForSection(base({ source_type: "project", source_id: "x" }), "project")).toBe(true);
    expect(isCommissionForSection(base({ source_type: "project", source_id: null }), "project")).toBe(false);
  });
});
