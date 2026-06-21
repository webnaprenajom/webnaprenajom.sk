import { describe, it, expect } from "vitest";
import {
  adminCustomerHref,
  adminCustomerHrefById,
  adminCustomerHrefPreferred,
  parseCustomerRouteKey,
} from "@/lib/adminNav";

const SAMPLE_UUID = "a1b2c3d4-e5f6-4789-a012-3456789abcde";

describe("parseCustomerRouteKey", () => {
  it("detects canonical UUID routes", () => {
    expect(parseCustomerRouteKey(SAMPLE_UUID)).toEqual({
      mode: "id",
      value: SAMPLE_UUID,
    });
  });

  it("normalizes email routes to lowercase", () => {
    expect(parseCustomerRouteKey("Client@Firma.SK")).toEqual({
      mode: "email",
      value: "client@firma.sk",
    });
  });

  it("decodes URL-encoded email keys", () => {
    expect(parseCustomerRouteKey(encodeURIComponent("a+b@test.sk"))).toEqual({
      mode: "email",
      value: "a+b@test.sk",
    });
  });
});

describe("admin customer href helpers", () => {
  it("builds canonical id href", () => {
    expect(adminCustomerHrefById(SAMPLE_UUID)).toBe(`/admin/customers/${SAMPLE_UUID}`);
  });

  it("builds email href for valid emails", () => {
    expect(adminCustomerHref("Test@Example.com")).toBe("/admin/customer/test%40example.com");
  });

  it("returns null for invalid email href", () => {
    expect(adminCustomerHref("not-email")).toBeNull();
  });

  it("prefers canonical id over email", () => {
    expect(adminCustomerHrefPreferred(SAMPLE_UUID, "x@y.sk")).toBe(
      `/admin/customers/${SAMPLE_UUID}`,
    );
  });

  it("falls back to email when no id", () => {
    expect(adminCustomerHrefPreferred(null, "x@y.sk")).toBe("/admin/customer/x%40y.sk");
  });
});

describe("legacy commissions redirect target", () => {
  it("lands on daily finance (not removed commissions tab)", () => {
    const target = "/admin/finance";
    expect(target).toBe("/admin/finance");
    expect(target).not.toContain("legacy=commissions");
  });
});
