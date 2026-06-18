import { describe, expect, it } from "vitest";
import {
  blockingRecordTypeLabel,
  isLeadDeleteRisky,
  parseDeleteResult,
  parseImpactSummary,
  parseLeadImpact,
  sectionActionLabel,
} from "@/lib/destructive/types";

describe("parseImpactSummary", () => {
  it("parses full impact with blocking records", () => {
    const raw = {
      entity_type: "rental_website",
      entity_id: "r1",
      entity_label: "example.sk",
      can_delete: false,
      block_reason: "Prenájom má potvrdené finančné fakty.",
      finance_critical: true,
      sections: [{ label: "Mesačné faktúry", count: 3, action: "delete" }],
      warnings: ["Provízie zostanú odpojené."],
      blocking_records: [
        {
          id: "p1",
          record_type: "payment_fact",
          table_name: "payment_records",
          label: "Platba 100 €",
          amount: 100,
          detail: "2026-05-01",
          cta_path: "/admin/finance?advanced=1&legacy=payments",
        },
      ],
      cta_links: [{ label: "Finance — platby", path: "/admin/finance?advanced=1&legacy=payments" }],
    };

    const impact = parseImpactSummary(raw);
    expect(impact?.can_delete).toBe(false);
    expect(impact?.blocking_records).toHaveLength(1);
    expect(impact?.blocking_records[0].cta_path).toContain("/admin/finance");
    expect(impact?.cta_links).toHaveLength(1);
    expect(impact?.finance_critical).toBe(true);
  });

  it("returns null for invalid payload", () => {
    expect(parseImpactSummary(null)).toBeNull();
    expect(parseImpactSummary({ entity_type: "hosting" })).toBeNull();
  });
});

describe("parseDeleteResult", () => {
  it("parses successful delete result", () => {
    const result = parseDeleteResult({
      ok: true,
      entity_type: "hosting",
      entity_id: "h1",
      deleted: { hosting_records: 1 },
      detached: {},
    });
    expect(result?.ok).toBe(true);
    expect(result?.deleted.hosting_records).toBe(1);
  });
});

describe("destructive labels", () => {
  it("labels section actions and record types", () => {
    expect(sectionActionLabel("detach")).toBe("Odpojí sa");
    expect(blockingRecordTypeLabel("payment_fact")).toBe("Potvrdená platba");
    expect(blockingRecordTypeLabel("payout_fact")).toBe("Potvrdená výplata");
  });
});

function leadPrecheckPayload(overrides: Record<string, unknown> = {}) {
  return {
    entity_type: "lead",
    entity_id: "lead-1",
    entity_label: "Test Lead",
    can_delete: true,
    block_reason: null,
    finance_critical: false,
    sections: [],
    lead_impact: { is_risky: false, sections: [] },
    warnings: [],
    blocking_records: [],
    cta_links: [],
    ...overrides,
  };
}

describe("lead destructive precheck (L1)", () => {
  it("parses empty lead with no linked data", () => {
    const impact = parseImpactSummary(leadPrecheckPayload());
    expect(impact?.entity_type).toBe("lead");
    expect(impact?.can_delete).toBe(true);
    expect(impact?.lead_impact?.sections).toEqual([]);
    expect(impact?.lead_impact?.is_risky).toBe(false);
    expect(impact?.blocking_records).toEqual([]);
  });

  it("parses customerLink info when customer has no finance facts", () => {
    const impact = parseImpactSummary(
      leadPrecheckPayload({
        lead_impact: {
          is_risky: false,
          sections: [
            {
              key: "customerLink",
              severity: "info",
              count: 1,
              linked_customer: {
                customer_id: "cust-1",
                has_finance_facts: false,
                rentals_count: 0,
                hosting_count: 0,
              },
            },
          ],
        },
        cta_links: [{ label: "Klientsky hub", path: "/admin/customers/cust-1" }],
      }),
    );
    const customerSection = impact?.lead_impact?.sections.find((s) => s.key === "customerLink");
    expect(customerSection?.severity).toBe("info");
    expect(customerSection?.linked_customer?.has_finance_facts).toBe(false);
    expect(isLeadDeleteRisky(impact!.lead_impact!)).toBe(false);
  });

  it("parses customerLink warning when customer has finance facts", () => {
    const impact = parseImpactSummary(
      leadPrecheckPayload({
        finance_critical: true,
        warnings: ["Prepojený klient má potvrdené finančné fakty."],
        lead_impact: {
          is_risky: true,
          sections: [
            {
              key: "customerLink",
              severity: "warning",
              count: 1,
              linked_customer: {
                customer_id: "cust-2",
                has_finance_facts: true,
                rentals_count: 2,
                hosting_count: 1,
              },
            },
          ],
        },
      }),
    );
    const customerSection = impact?.lead_impact?.sections.find((s) => s.key === "customerLink");
    expect(customerSection?.severity).toBe("warning");
    expect(customerSection?.linked_customer?.rentals_count).toBe(2);
    expect(impact?.finance_critical).toBe(true);
    expect(impact?.can_delete).toBe(true);
    expect(impact?.blocking_records).toEqual([]);
    expect(isLeadDeleteRisky(impact!.lead_impact!)).toBe(true);
  });

  it("parses tasks and projectNotes detach sections", () => {
    const impact = parseImpactSummary(
      leadPrecheckPayload({
        lead_impact: {
          is_risky: false,
          sections: [
            { key: "tasks", severity: "info", count: 3, action: "detach" },
            { key: "projectNotes", severity: "info", count: 1, action: "detach" },
            { key: "leadLogs", severity: "info", count: 5, action: "keep" },
          ],
        },
      }),
    );
    expect(impact?.lead_impact?.sections).toHaveLength(3);
    expect(impact?.lead_impact?.sections.find((s) => s.key === "tasks")?.action).toBe("detach");
    expect(impact?.lead_impact?.sections.find((s) => s.key === "leadLogs")?.action).toBe("keep");
  });

  it("parseLeadImpact rejects invalid section keys", () => {
    const parsed = parseLeadImpact({
      is_risky: false,
      sections: [{ key: "invalid", severity: "info", count: 1 }],
    });
    expect(parsed?.sections).toEqual([]);
  });
});

describe("blocked delete UX contract", () => {
  it("blocked impact disables confirm when can_delete is false", () => {
    const impact = parseImpactSummary({
      entity_type: "customer",
      entity_id: "c1",
      entity_label: "ACME",
      can_delete: false,
      block_reason: "Klient má potvrdené finančné fakty.",
      finance_critical: true,
      sections: [],
      warnings: [],
      blocking_records: [
        {
          id: "po1",
          record_type: "payout_fact",
          table_name: "payout_records",
          label: "Výplata 50 €",
          amount: 50,
          cta_path: "/admin/finance?advanced=1&legacy=payouts",
        },
      ],
      cta_links: [
        { label: "Finance — výplaty", path: "/admin/finance?advanced=1&legacy=payouts" },
        { label: "Klientsky hub", path: "/admin/customers/c1" },
      ],
    });
    expect(impact?.can_delete).toBe(false);
    expect(impact?.blocking_records.length).toBeGreaterThan(0);
    expect(impact?.cta_links.some((l) => l.path.includes("finance"))).toBe(true);
  });
});
