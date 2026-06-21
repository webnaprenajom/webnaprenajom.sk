import { describe, expect, it } from "vitest";
import {
  customerProfileFromRow,
  normalizeCustomerProfileForm,
  validateCustomerProfileForm,
} from "@/lib/crmLookup/customerProfile";
import type { CustomerRow } from "@/lib/crmLookup/customers";

const sampleRow: CustomerRow = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  email: "klient@firma.sk",
  display_name: "ACME s.r.o.",
  metadata: {
    phone: "+421900111222",
    company: "ACME",
    notes: "VIP",
  },
};

describe("customerProfileFromRow", () => {
  it("maps canonical row and metadata", () => {
    const form = customerProfileFromRow(sampleRow);
    expect(form.displayName).toBe("ACME s.r.o.");
    expect(form.email).toBe("klient@firma.sk");
    expect(form.phone).toBe("+421900111222");
    expect(form.notes).toBe("VIP");
  });

  it("falls back to lead phone when metadata empty", () => {
    const form = customerProfileFromRow({ ...sampleRow, metadata: {} }, "+421911");
    expect(form.phone).toBe("+421911");
  });
});

describe("validateCustomerProfileForm", () => {
  it("requires display name", () => {
    const result = validateCustomerProfileForm(
      normalizeCustomerProfileForm({ ...customerProfileFromRow(sampleRow), displayName: "  " }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Názov/);
  });

  it("validates email when provided", () => {
    const result = validateCustomerProfileForm(
      normalizeCustomerProfileForm({ ...customerProfileFromRow(sampleRow), email: "not-an-email" }),
    );
    expect(result.ok).toBe(false);
  });

  it("accepts valid profile", () => {
    const result = validateCustomerProfileForm(customerProfileFromRow(sampleRow));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.email).toBe("klient@firma.sk");
  });
});
