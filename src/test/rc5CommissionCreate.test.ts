import { describe, it, expect } from "vitest";
import {
  buildCommissionInsertPayload,
  rentalHasJsonImplementers,
  RENTAL_COMMISSION_COEXISTENCE_NOTE,
} from "@/lib/commissionCreateHelpers";

describe("buildCommissionInsertPayload", () => {
  it("requires implementer", () => {
    const result = buildCommissionInsertPayload({
      title: "Bonus",
      amount: 100,
      date: "2026-06-01",
      implementer: "",
      customer_id: "550e8400-e29b-41d4-a716-446655440000",
      customer_email: "a@test.sk",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("realizátora");
  });

  it("builds linked rental commission", () => {
    const result = buildCommissionInsertPayload({
      title: "Prenájom bonus",
      amount: 50,
      date: "2026-06-01",
      implementer: "Jan",
      source_type: "rental",
      source_id: "550e8400-e29b-41d4-a716-446655440001",
      customer_id: "550e8400-e29b-41d4-a716-446655440000",
      customer_email: "a@test.sk",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.source_type).toBe("rental");
      expect(result.payload.implementer).toBe("Jan");
      expect(result.warnings).toHaveLength(0);
    }
  });

  it("warns on customer-linked but sourceless commission", () => {
    const result = buildCommissionInsertPayload({
      title: "Workbench bonus",
      amount: 25,
      date: "2026-06-01",
      implementer: "Eva",
      customer_id: "550e8400-e29b-41d4-a716-446655440000",
      customer_email: "a@test.sk",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings.some((w) => w.includes("legacy"))).toBe(true);
    }
  });

  it("uses other type explicitly from workbench", () => {
    const result = buildCommissionInsertPayload({
      title: "Other",
      amount: 10,
      date: "2026-06-01",
      implementer: "Jan",
      source_type: "other",
      customer_email: "a@test.sk",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.source_type).toBe("other");
      expect(result.payload.source_id).toBeNull();
    }
  });
});

describe("rental commission coexistence", () => {
  it("detects JSON implementers", () => {
    expect(rentalHasJsonImplementers([{ name: "Jan", percentage: 30 }])).toBe(true);
    expect(rentalHasJsonImplementers([])).toBe(false);
  });

  it("documents dual model", () => {
    expect(RENTAL_COMMISSION_COEXISTENCE_NOTE).toContain("JSON");
  });
});
