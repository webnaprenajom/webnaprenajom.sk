import { describe, it, expect } from "vitest";
import {
  buildPostgrestIlikeOr,
  escapeIlikePattern,
} from "@/lib/crmLookup/normalizeIdentity";
import {
  shouldPromoteLeadToCustomer,
  hasStrongCustomerIdentity,
  LEAD_CUSTOMER_PROMOTION_STATUSES,
} from "@/lib/crmLookup/leadCustomerLifecycleRules";

describe("buildPostgrestIlikeOr", () => {
  it("builds multi-field ilike filter", () => {
    const filter = buildPostgrestIlikeOr(["display_name", "email"], "acme");
    expect(filter).toBe("display_name.ilike.%acme%,email.ilike.%acme%");
  });

  it("quotes patterns containing commas", () => {
    const filter = buildPostgrestIlikeOr(["display_name"], "ACME, s.r.o.");
    expect(filter).toContain('"');
    expect(filter).toContain("ACME, s.r.o.");
  });

  it("escapes ilike wildcards", () => {
    expect(escapeIlikePattern("100%")).toBe("100\\%");
  });
});

describe("leadCustomerLifecycle rules", () => {
  it("promotes only won/order statuses", () => {
    expect(LEAD_CUSTOMER_PROMOTION_STATUSES).toContain("won");
    expect(LEAD_CUSTOMER_PROMOTION_STATUSES).toContain("order");
    expect(shouldPromoteLeadToCustomer("won")).toBe(true);
    expect(shouldPromoteLeadToCustomer("order")).toBe(true);
    expect(shouldPromoteLeadToCustomer("new")).toBe(false);
    expect(shouldPromoteLeadToCustomer("contacted")).toBe(false);
  });

  it("requires valid email for strong identity", () => {
    expect(hasStrongCustomerIdentity({ email: "a@b.sk" })).toBe(true);
    expect(hasStrongCustomerIdentity({ email: "not-email" })).toBe(false);
    expect(
      hasStrongCustomerIdentity({
        customer_id: "550e8400-e29b-41d4-a716-446655440000",
      }),
    ).toBe(true);
  });
});
