import { describe, it, expect } from "vitest";
import {
  mapLeadSearchRow,
  mergeClientSearchResults,
} from "@/lib/crmLookup/clientSearch";
import {
  parseInsertRowId,
  validateFormEmail,
  isValidEntityId,
} from "@/lib/crmLookup/entitySaveHelpers";

describe("clientSearch lead promotion", () => {
  it("maps linked lead to customer kind for Clients discovery", () => {
    const row = mapLeadSearchRow({
      id: "lead-1",
      name: "ACME s.r.o.",
      email: "acme@firma.sk",
      customer_id: "550e8400-e29b-41d4-a716-446655440000",
      status: "won",
    });
    expect(row.kind).toBe("customer");
    expect(row.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(row.meta?.promoted_from_lead).toBe(true);
    expect(row.meta?.lead_id).toBe("lead-1");
  });

  it("keeps unlinked lead as lead kind", () => {
    const row = mapLeadSearchRow({
      id: "lead-2",
      name: "Beta",
      email: "beta@test.sk",
      customer_id: null,
      status: "new",
    });
    expect(row.kind).toBe("lead");
    expect(row.id).toBe("lead-2");
  });

  it("dedupes customer and promoted lead by email", () => {
    const customers = [
      mapLeadSearchRow({
        id: "c1",
        name: "ACME",
        email: "acme@firma.sk",
        customer_id: "550e8400-e29b-41d4-a716-446655440000",
      }),
    ];
    const leads = [
      mapLeadSearchRow({
        id: "lead-1",
        name: "ACME",
        email: "acme@firma.sk",
        customer_id: "550e8400-e29b-41d4-a716-446655440000",
        status: "won",
      }),
      mapLeadSearchRow({
        id: "lead-2",
        name: "Other",
        email: "other@test.sk",
        customer_id: null,
      }),
    ];
    const merged = mergeClientSearchResults(customers, leads, 10);
    expect(merged).toHaveLength(2);
    expect(merged.filter((r) => r.email === "acme@firma.sk")).toHaveLength(1);
  });
});

describe("parseInsertRowId", () => {
  it("accepts valid insert response", () => {
    expect(parseInsertRowId({ id: "550e8400-e29b-41d4-a716-446655440000" }, null, "Hosting")).toEqual({
      ok: true,
      id: "550e8400-e29b-41d4-a716-446655440000",
    });
  });

  it("rejects missing id after insert", () => {
    const result = parseInsertRowId(null, null, "Hosting");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Hosting");
      expect(result.error).toContain("ID");
    }
  });

  it("surfaces supabase error message", () => {
    const result = parseInsertRowId(null, { message: "RLS violation" }, "Projekt");
    expect(result).toEqual({ ok: false, error: "RLS violation", code: undefined });
  });
});

describe("validateFormEmail", () => {
  it("allows empty email", () => {
    expect(validateFormEmail("")).toEqual({ valid: true, normalized: null });
  });

  it("rejects invalid email", () => {
    expect(validateFormEmail("not-an-email").valid).toBe(false);
  });
});

describe("isValidEntityId", () => {
  it("validates uuid for detail routes", () => {
    expect(isValidEntityId("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isValidEntityId("undefined")).toBe(false);
    expect(isValidEntityId("")).toBe(false);
  });
});
