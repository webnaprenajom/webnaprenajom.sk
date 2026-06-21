import { describe, expect, it } from "vitest";
import type { CommissionRow } from "@/lib/commissionSource";
import {
  buildCommissionParentContext,
  classifyRentalCommissionLiveState,
  paymentRecordHasLiveDealParent,
} from "@/lib/finance/rentalCommissionEntitlement";
import { implementerTotalsFromCommissionPayouts } from "@/lib/finance/commissionPayoutStatus";

const parents = buildCommissionParentContext({
  projects: [{ id: "p-live" }],
  hosting: [],
  marketing: [],
  websites: [],
});

describe("entity deal commission entitlement", () => {
  it("orphan project commission is stale when parent deleted", () => {
    const c: CommissionRow = {
      id: "c-1",
      title: "Ghost",
      implementer: "Peter",
      amount: 100,
      payment_status: "unpaid",
      note: null,
      date: "2026-06-01",
      source_type: "project",
      source_id: "p-deleted",
    };
    expect(classifyRentalCommissionLiveState(c, [], [], parents)).toBe("stale_orphan");
  });

  it("live project commission surfaces in implementer totals", () => {
    const live: CommissionRow = {
      id: "c-2",
      title: "Live",
      implementer: "Peter",
      amount: 200,
      payment_status: "unpaid",
      note: null,
      date: "2026-06-01",
      source_type: "project",
      source_id: "p-live",
    };
    const orphan: CommissionRow = {
      id: "c-3",
      title: "Ghost",
      implementer: "Peter",
      amount: 999,
      payment_status: "unpaid",
      note: null,
      date: "2026-06-01",
      source_type: "marketing",
      source_id: "m-gone",
    };
    const totals = implementerTotalsFromCommissionPayouts([live, orphan], [], {
      websites: [],
      allCommissions: [live, orphan],
      parents,
    });
    expect(totals.get("Peter")?.unpaid).toBe(200);
  });

  it("orphan entity payment_records excluded from live parent check", () => {
    expect(
      paymentRecordHasLiveDealParent(
        { source_table: "project_notes", source_id: "p-deleted" },
        parents,
      ),
    ).toBe(false);
    expect(
      paymentRecordHasLiveDealParent(
        { source_table: "project_notes", source_id: "p-live" },
        parents,
      ),
    ).toBe(true);
  });
});
