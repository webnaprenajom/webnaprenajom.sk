import { describe, expect, it } from "vitest";
import type { CommissionRow } from "@/lib/commissionSource";
import {
  buildRentalCommissionDeals,
  summarizeRentalCommissionDeals,
} from "@/lib/finance/rentalCommissionDeal";
import {
  classifyRentalCommissionLiveState,
  rentalImplementerHasLiveEntitlement,
} from "@/lib/finance/rentalCommissionEntitlement";
import { buildImplementerFinanceTotalsWithRentals } from "@/lib/finance/rentalImplementerFinanceTotals";
import { buildImplementerCommissionViewRows } from "@/lib/finance/implementerCommissionView";

const rentalCommission = (over: Partial<CommissionRow> = {}): CommissionRow =>
  ({
    id: "c-orphan",
    title: "web.sk · prenájom 2026",
    amount: 600,
    date: "2026-12-31",
    implementer: "Peter",
    payment_status: "unpaid",
    source_type: "rental",
    source_id: "w1",
    note: null,
    ...over,
  }) as CommissionRow;

describe("rentalCommissionEntitlement", () => {
  const websites = [{ id: "w1", implementers: [] as unknown[] }];

  it("detects empty implementers JSON as no live entitlement", () => {
    expect(rentalImplementerHasLiveEntitlement("w1", "Peter", websites)).toBe(false);
    expect(classifyRentalCommissionLiveState(rentalCommission(), websites, [])).toBe(
      "stale_orphan",
    );
  });

  it("hides stale orphan rental commissions from finance totals", () => {
    const totals = buildImplementerFinanceTotalsWithRentals([rentalCommission()], [], {
      websites,
      payments: [{ website_id: "w1", year: 2026, month: 1, status: "paid" }],
      allCommissions: [rentalCommission()],
      year: 2026,
    });
    expect(totals.get("Peter")).toBeUndefined();
  });

  it("hides stale orphan from implementer commission view rows", () => {
    const rows = buildImplementerCommissionViewRows({
      implementer: "Peter",
      year: 2026,
      commissions: [rentalCommission()],
      payoutRecords: [],
      websites: [{ id: "w1", name: "web.sk", monthly_price: 100, implementers: [] }],
      payments: [],
    });
    expect(rows).toHaveLength(0);
  });

  it("keeps audited payout as historical rental deal when JSON entitlement removed", () => {
    const commissions = [rentalCommission()];
    const payoutRecords = [
      {
        id: "p1",
        source_table: "commissions",
        source_id: "c-orphan",
        amount: 200,
        paid_at: "2026-06-01T12:00:00Z",
        truth_level: "payout_fact",
      },
    ];
    const { rentalDeals } = buildRentalCommissionDeals({
      implementerName: "Peter",
      year: 2026,
      websites: [{ id: "w1", name: "web.sk", client_name: null, implementers: [] }],
      commissions,
      payoutRecords,
      yearStats: () => ({ paid: 0, potential: 0 }),
    });
    expect(rentalDeals).toHaveLength(1);
    expect(rentalDeals[0].dealType).toBe("historical_rental");
    expect(rentalDeals[0].paidAmount).toBe(200);
    expect(rentalDeals[0].remainingAmount).toBe(0);

    const totals = buildImplementerFinanceTotalsWithRentals(commissions, payoutRecords, {
      websites,
      payments: [],
      allCommissions: commissions,
      year: 2026,
    });
    expect(totals.get("Peter")?.paidAudited).toBe(200);
    expect(totals.get("Peter")?.unpaid).toBe(0);
  });

  it("live JSON entitlement still produces rental deals after implementer removal elsewhere", () => {
    const websitesWithPeter = [
      {
        id: "w1",
        implementers: [{ name: "Peter", percentage: 50, payment_status: "unpaid" }],
      },
    ];
    const { rentalDeals } = buildRentalCommissionDeals({
      implementerName: "Peter",
      year: 2026,
      websites: [
        { id: "w1", name: "web.sk", client_name: null, implementers: websitesWithPeter[0].implementers },
      ],
      commissions: [],
      payoutRecords: [],
      yearStats: () => ({ paid: 100, potential: 1200 }),
    });
    const sum = summarizeRentalCommissionDeals(rentalDeals);
    expect(sum.count).toBe(1);
    expect(sum.potential).toBe(600);
  });
});
