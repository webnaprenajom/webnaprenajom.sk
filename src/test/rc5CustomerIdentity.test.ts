import { describe, it, expect } from "vitest";
import {
  assessCustomerCreateRisk,
  findDuplicateCustomerCandidates,
  mergePriorityFields,
  pickCanonicalCustomerRecord,
  planRentalCustomerLink,
  resolveIdentityMatchLevel,
} from "@/lib/crmLookup/customerIdentityRules";

describe("resolveIdentityMatchLevel", () => {
  it("prefers customer_id over email", () => {
    expect(
      resolveIdentityMatchLevel({
        customer_id: "550e8400-e29b-41d4-a716-446655440000",
        customer_email: "a@test.sk",
      }),
    ).toBe("customer_id");
  });

  it("uses email when no id", () => {
    expect(resolveIdentityMatchLevel({ customer_email: "a@test.sk" })).toBe("email");
  });
});

describe("findDuplicateCustomerCandidates", () => {
  it("flags same name with different emails", () => {
    const candidates = findDuplicateCustomerCandidates([
      { id: "c1", email: "a@test.sk", display_name: "ACME s.r.o." },
      { id: "c2", email: "b@test.sk", display_name: "ACME s.r.o." },
    ]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].confidence).toBe("high");
    expect(candidates[0].canonicalId).toBeTruthy();
  });
});

describe("assessCustomerCreateRisk", () => {
  it("links to existing email", () => {
    const result = assessCustomerCreateRisk(
      { email: "a@test.sk", displayName: "ACME" },
      { id: "c1", email: "a@test.sk", display_name: "ACME" },
      [],
    );
    expect(result.risk).toBe("link_existing");
    expect(result.linkToId).toBe("c1");
  });

  it("blocks ambiguous name matches", () => {
    const result = assessCustomerCreateRisk(
      { email: "new@test.sk", displayName: "ACME" },
      null,
      [
        { id: "c1", email: "a@test.sk", display_name: "ACME" },
        { id: "c2", email: "b@test.sk", display_name: "ACME" },
      ],
    );
    expect(result.risk).toBe("blocked_ambiguous");
  });
});

describe("pickCanonicalCustomerRecord", () => {
  it("prefers row with email", () => {
    const canonical = pickCanonicalCustomerRecord([
      { id: "c1", email: null, display_name: "X" },
      { id: "c2", email: "x@test.sk", display_name: "X" },
    ]);
    expect(canonical?.id).toBe("c2");
  });
});

describe("mergePriorityFields", () => {
  it("chooses canonical survivor", () => {
    const merged = mergePriorityFields(
      { id: "c1", email: null, display_name: "Short" },
      { id: "c2", email: "x@test.sk", display_name: "Longer Name" },
    );
    expect(merged.canonicalId).toBe("c2");
    expect(merged.keepEmail).toBe("x@test.sk");
  });
});

describe("planRentalCustomerLink", () => {
  it("auto-links single lead with customer_id", () => {
    const plans = planRentalCustomerLink(
      [{ id: "r1", client_name: "ACME s.r.o.", customer_id: null }],
      [{ id: "l1", name: "ACME s.r.o.", customer_id: "550e8400-e29b-41d4-a716-446655440000" }],
    );
    expect(plans[0].outcome).toBe("auto_linked");
    expect(plans[0].proposedCustomerId).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("requires review for ambiguous lead names", () => {
    const plans = planRentalCustomerLink(
      [{ id: "r1", client_name: "ACME", customer_id: null }],
      [
        { id: "l1", name: "ACME", customer_id: "c1" },
        { id: "l2", name: "ACME", customer_id: "c2" },
      ],
    );
    expect(plans[0].outcome).toBe("review_needed");
  });
});
