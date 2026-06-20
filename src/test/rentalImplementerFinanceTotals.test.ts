import { describe, expect, it } from "vitest";
import {
  buildFinanceRentalImplementerDetailRows,
  buildImplementerFinanceTotalsWithRentals,
  mergeRentalJsonIntoImplementerTotals,
  rentalYearClientPaidTotal,
} from "@/lib/finance/rentalImplementerFinanceTotals";
import { implementerTotalsFromCommissionPayouts } from "@/lib/finance/commissionPayoutStatus";
import type { CommissionRow } from "@/lib/commissionSource";

describe("rentalImplementerFinanceTotals", () => {
  it("sums client-paid months for a website year", () => {
    const paid = rentalYearClientPaidTotal(
      { id: "w1", monthly_price: 100 },
      [
        { website_id: "w1", year: 2026, month: 1, status: "paid" },
        { website_id: "w1", year: 2026, month: 2, status: "unpaid" },
      ],
      2026,
    );
    expect(paid).toBe(100);
  });

  it("adds JSON rental share when no materialized commission exists", () => {
    const base = implementerTotalsFromCommissionPayouts([], []);
    const merged = mergeRentalJsonIntoImplementerTotals(base, {
      websites: [
        {
          id: "w1",
          monthly_price: 200,
          implementers: [{ name: "Peter", percentage: 50, payment_status: "unpaid" }],
        },
      ],
      payments: [{ website_id: "w1", year: 2026, month: 3, status: "paid" }],
      commissions: [],
      year: 2026,
    });
    expect(merged.get("Peter")?.unpaid).toBe(100);
    expect(merged.get("Peter")?.lineCount).toBe(1);
  });

  it("skips JSON share when materialized rental commission exists for same year", () => {
    const commissions: CommissionRow[] = [
      {
        id: "c-rental",
        title: "Site",
        amount: 100,
        date: "2026-12-31",
        implementer: "Peter",
        payment_status: "unpaid",
        source_type: "rental",
        source_id: "w1",
      } as CommissionRow,
    ];
    const base = implementerTotalsFromCommissionPayouts(commissions, []);
    const merged = mergeRentalJsonIntoImplementerTotals(base, {
      websites: [
        {
          id: "w1",
          monthly_price: 200,
          implementers: [{ name: "Peter", percentage: 50, payment_status: "unpaid" }],
        },
      ],
      payments: [{ website_id: "w1", year: 2026, month: 3, status: "paid" }],
      commissions,
      year: 2026,
    });
    const peter = merged.get("Peter");
    expect(peter?.unpaid).toBe(100);
    expect(peter?.lineCount).toBe(1);
  });

  it("maps JSON payment_status paid to workflow-unaudited bucket", () => {
    const merged = buildImplementerFinanceTotalsWithRentals([], [], {
      websites: [
        {
          id: "w1",
          monthly_price: 100,
          implementers: [{ name: "Maroš", percentage: 100, payment_status: "paid" }],
        },
      ],
      payments: [{ website_id: "w1", year: 2026, month: 1, status: "paid" }],
      allCommissions: [],
      year: 2026,
    });
    expect(merged.get("Maroš")?.paidWorkflowUnaudited).toBe(100);
    expect(merged.get("Maroš")?.unpaid).toBe(0);
  });

  it("builds finance detail rows for JSON rental shares", () => {
    const rows = buildFinanceRentalImplementerDetailRows({
      implementer: "Peter",
      websites: [
        {
          id: "w1",
          name: "web.sk",
          monthly_price: 100,
          implementers: [{ name: "Peter", percentage: 50, payment_status: "unpaid" }],
        },
      ],
      payments: [{ website_id: "w1", year: 2026, month: 1, status: "paid" }],
      commissions: [],
      year: 2026,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].websiteName).toBe("web.sk");
    expect(rows[0].amount).toBe(50);
  });
});
