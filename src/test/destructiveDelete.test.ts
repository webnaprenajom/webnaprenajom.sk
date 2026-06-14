import { describe, expect, it } from "vitest";
import {
  blockingRecordTypeLabel,
  parseDeleteResult,
  parseImpactSummary,
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
