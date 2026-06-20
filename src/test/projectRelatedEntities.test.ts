import { describe, it, expect } from "vitest";
import { buildProjectRelatedQueryPlan } from "@/lib/admin/projectRelatedEntities";

describe("buildProjectRelatedQueryPlan", () => {
  it("prefers customer_id for hosting and rentals when present", () => {
    const plan = buildProjectRelatedQueryPlan({
      customer_id: "cust-1",
      customer_email: "a@b.com",
      client_name: "Acme",
    });
    expect(plan).toEqual({
      linkMode: "canonical",
      hosting: "customer_id",
      rentals: "customer_id",
      hostingEmail: null,
      rentalClientName: null,
      customerId: "cust-1",
    });
  });

  it("falls back to email/name only when customer_id is missing", () => {
    const plan = buildProjectRelatedQueryPlan({
      customer_id: null,
      customer_email: "  Client@Example.COM ",
      client_name: "  Acme  s.r.o. ",
    });
    expect(plan.linkMode).toBe("estimated");
    expect(plan.hosting).toBe("customer_email");
    expect(plan.rentals).toBe("client_name");
    expect(plan.hostingEmail).toBe("client@example.com");
    expect(plan.rentalClientName).toBe("Acme s.r.o.");
    expect(plan.customerId).toBeNull();
  });

  it("returns none when no canonical or bridge identity exists", () => {
    const plan = buildProjectRelatedQueryPlan({
      customer_id: null,
      customer_email: null,
      client_name: "   ",
    });
    expect(plan.hosting).toBe("none");
    expect(plan.rentals).toBe("none");
    expect(plan.linkMode).toBe("estimated");
  });
});
