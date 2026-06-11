import { describe, it, expect } from "vitest";
import {
  planEmailBackfill,
  planNameBackfill,
  summarizeBackfill,
  type CustomerSeed,
  type LeadSeed,
} from "@/lib/crmLookup/customerBackfill";
import { isCanonicalCustomerId } from "@/lib/crmLookup/customers";

describe("customers helpers", () => {
  it("detects UUID customer ids", () => {
    expect(isCanonicalCustomerId("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isCanonicalCustomerId("not-a-uuid")).toBe(false);
    expect(isCanonicalCustomerId("client@firma.sk")).toBe(false);
  });
});

describe("customerBackfill planning", () => {
  const customers = new Map<string, CustomerSeed>([
    ["a@firma.sk", { id: "c1", email: "a@firma.sk", display_name: "ACME" }],
  ]);

  it("auto-links by exact email", () => {
    const items = planEmailBackfill(
      [{ table: "leads", id: "l1", email: "A@firma.sk" }],
      customers,
    );
    expect(items[0].outcome).toBe("auto_linked");
    expect(items[0].proposed_customer_id).toBe("c1");
  });

  it("flags missing customer seed for review", () => {
    const items = planEmailBackfill(
      [{ table: "leads", id: "l2", email: "new@firma.sk" }],
      customers,
    );
    expect(items[0].outcome).toBe("review_needed");
  });

  it("requires unique lead with customer_id for name backfill", () => {
    const leads: LeadSeed[] = [
      { id: "l1", email: "a@firma.sk", name: "ACME s.r.o.", customer_id: "c1" },
    ];
    const items = planNameBackfill(
      [{ table: "rental_websites", id: "r1", client_name: "ACME s.r.o." }],
      leads,
    );
    expect(items[0].outcome).toBe("auto_linked");
  });

  it("rejects ambiguous name matches", () => {
    const leads: LeadSeed[] = [
      { id: "l1", email: "a@a.sk", name: "ACME", customer_id: "c1" },
      { id: "l2", email: "b@b.sk", name: "ACME", customer_id: "c2" },
    ];
    const items = planNameBackfill(
      [{ table: "rental_websites", id: "r1", client_name: "ACME" }],
      leads,
    );
    expect(items[0].outcome).toBe("review_needed");
  });

  it("summarizes outcomes", () => {
    const summary = summarizeBackfill([
      { table: "t", id: "1", outcome: "auto_linked", reason: "ok" },
      { table: "t", id: "2", outcome: "review_needed", reason: "x" },
      { table: "t", id: "3", outcome: "unmatched", reason: "y" },
    ]);
    expect(summary.auto_linked).toBe(1);
    expect(summary.review_needed).toBe(1);
    expect(summary.unmatched).toBe(1);
  });
});
