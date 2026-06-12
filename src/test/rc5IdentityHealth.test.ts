import { describe, it, expect } from "vitest";
import { buildIdentityHealthChecklist } from "@/lib/crmLookup/identityHealthChecklist";

describe("buildIdentityHealthChecklist", () => {
  it("includes RC5 identity metrics", () => {
    const items = buildIdentityHealthChecklist({
      legacyCommissions: 1,
      partialCommissions: 0,
      leadsWithoutCustomer: 2,
      unlinkedInboundComm: 0,
      openTasksWithoutCustomer: 0,
      tasksBackfillableViaLead: 1,
      rentalsWithoutCustomer: 5,
      rentalsBackfillableViaLead: 2,
      commissionsWithoutCustomer: 3,
      duplicateCustomerCandidates: 1,
      customersWithoutEmail: 4,
    });
    const ids = items.map((i) => i.id);
    expect(ids).toContain("rentalsWithoutCustomer");
    expect(ids).toContain("duplicateCustomerCandidates");
    expect(ids).toContain("legacyCommissions");
  });
});
