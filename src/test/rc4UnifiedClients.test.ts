import { describe, it, expect } from "vitest";
import {
  mergeUnifiedClientSeeds,
  unifiedClientSectionSummary,
} from "@/lib/crmLookup/unifiedClientDedupe";

describe("mergeUnifiedClientSeeds", () => {
  it("dedupes by customer_id first", () => {
    const entries = mergeUnifiedClientSeeds([
      {
        customerId: "550e8400-e29b-41d4-a716-446655440000",
        displayName: "ACME s.r.o.",
        email: "acme@firma.sk",
        section: "project",
      },
      {
        customerId: "550e8400-e29b-41d4-a716-446655440000",
        displayName: "ACME",
        email: "acme@firma.sk",
        section: "hosting",
      },
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].projectCount).toBe(1);
    expect(entries[0].hostingCount).toBe(1);
  });

  it("dedupes by email when customer_id missing on one seed", () => {
    const entries = mergeUnifiedClientSeeds([
      {
        customerId: "550e8400-e29b-41d4-a716-446655440000",
        displayName: "ACME s.r.o.",
        email: "acme@firma.sk",
        section: "project",
      },
      {
        displayName: "ACME",
        email: "acme@firma.sk",
        section: "hosting",
      },
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].hostingCount).toBe(1);
    expect(entries[0].projectCount).toBe(1);
  });

  it("keeps separate clients when identity differs", () => {
    const entries = mergeUnifiedClientSeeds([
      { displayName: "Alpha", email: "a@test.sk", section: "project" },
      { displayName: "Beta", email: "b@test.sk", section: "project" },
    ]);
    expect(entries).toHaveLength(2);
  });
});

describe("unifiedClientSectionSummary", () => {
  it("formats section counts", () => {
    const summary = unifiedClientSectionSummary({
      customerId: null,
      displayName: "X",
      email: null,
      nameKey: null,
      sections: new Set(["project", "hosting"]),
      projectCount: 2,
      hostingCount: 1,
      rentalCount: 0,
      leadCount: 0,
    });
    expect(summary).toContain("2 proj.");
    expect(summary).toContain("1 host.");
  });
});
