import { describe, expect, it } from "vitest";
import type { CommissionRow } from "@/lib/commissionSource";
import {
  buildRentalCommissionDeals,
  deriveDealPayoutStatus,
  summarizeRentalCommissionDeals,
} from "@/lib/finance/rentalCommissionDeal";
import { buildImplementerFinanceTotalsWithRentals } from "@/lib/finance/rentalImplementerFinanceTotals";

describe("rentalCommissionDeal", () => {
  it("derives payout status from paid vs potential", () => {
    expect(deriveDealPayoutStatus(300, 0)).toBe("unpaid");
    expect(deriveDealPayoutStatus(300, 100)).toBe("partially_paid");
    expect(deriveDealPayoutStatus(300, 300)).toBe("paid");
    expect(deriveDealPayoutStatus(300, 350)).toBe("overpaid");
  });

  it("merges rental JSON and materialized commission into one deal", () => {
    const commissions: CommissionRow[] = [
      {
        id: "c1",
        title: "Site",
        amount: 300,
        date: "2026-12-31",
        implementer: "Peter",
        payment_status: "unpaid",
        source_type: "rental",
        source_id: "w1",
      } as CommissionRow,
    ];
    const { rentalDeals } = buildRentalCommissionDeals({
      implementerName: "Peter",
      year: 2026,
      websites: [
        {
          id: "w1",
          name: "web.sk",
          client_name: "Klient",
          implementers: [{ name: "Peter", percentage: 50, payment_status: "unpaid" }],
        },
      ],
      commissions,
      payoutRecords: [],
      yearStats: () => ({ paid: 200, potential: 600 }),
    });
    expect(rentalDeals).toHaveLength(1);
    expect(rentalDeals[0].potentialCommission).toBe(300);
    expect(rentalDeals[0].commissionId).toBe("c1");
    expect(rentalDeals[0].hadDualSource).toBe(true);
  });

  it("computes paid and remaining from payout_records", () => {
    const commissions: CommissionRow[] = [
      {
        id: "c1",
        title: "Site",
        amount: 300,
        date: "2026-12-31",
        implementer: "Peter",
        payment_status: "unpaid",
        source_type: "rental",
        source_id: "w1",
      } as CommissionRow,
    ];
    const { rentalDeals } = buildRentalCommissionDeals({
      implementerName: "Peter",
      year: 2026,
      websites: [
        {
          id: "w1",
          name: "web.sk",
          client_name: null,
          implementers: [{ name: "Peter", percentage: 100, payment_status: "unpaid" }],
        },
      ],
      commissions,
      payoutRecords: [
        {
          id: "p1",
          source_table: "commissions",
          source_id: "c1",
          amount: 100,
          paid_at: "2026-06-01T12:00:00Z",
          truth_level: "payout_fact",
        },
        {
          id: "p2",
          source_table: "commissions",
          source_id: "c1",
          amount: 50,
          paid_at: "2026-07-01T12:00:00Z",
          truth_level: "payout_fact",
        },
      ],
      yearStats: () => ({ paid: 300, potential: 300 }),
    });
    expect(rentalDeals[0].paidAmount).toBe(150);
    expect(rentalDeals[0].remainingAmount).toBe(150);
    expect(rentalDeals[0].payoutStatus).toBe("partially_paid");
    expect(rentalDeals[0].payoutTransactions).toHaveLength(2);
  });

  it("summarizes deals without double counting", () => {
    const deals = [
      {
        dealKey: "a",
        dealType: "rental" as const,
        title: "A",
        clientName: null,
        potentialCommission: 300,
        paidAmount: 100,
        remainingAmount: 200,
        payoutStatus: "partially_paid" as const,
        workflowPaidUnaudited: false,
        paymentForm: "",
        note: "",
        lastPayoutAt: null,
        payoutTransactions: [],
      },
      {
        dealKey: "b",
        dealType: "rental" as const,
        title: "B",
        clientName: null,
        potentialCommission: 200,
        paidAmount: 200,
        remainingAmount: 0,
        payoutStatus: "paid" as const,
        workflowPaidUnaudited: false,
        paymentForm: "",
        note: "",
        lastPayoutAt: null,
        payoutTransactions: [],
      },
    ];
    const sum = summarizeRentalCommissionDeals(deals);
    expect(sum.count).toBe(2);
    expect(sum.potential).toBe(500);
    expect(sum.paid).toBe(300);
    expect(sum.remaining).toBe(200);
  });

  it("finance totals skip JSON when commission materialized — no double count", () => {
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
    const totals = buildImplementerFinanceTotalsWithRentals(commissions, [], {
      websites: [
        {
          id: "w1",
          monthly_price: 200,
          implementers: [{ name: "Peter", percentage: 50, payment_status: "unpaid" }],
        },
      ],
      payments: [{ website_id: "w1", year: 2026, month: 3, status: "paid" }],
      allCommissions: commissions,
      year: 2026,
    });
    const peter = totals.get("Peter");
    expect(peter?.unpaid).toBe(100);
    expect(peter?.lineCount).toBe(1);
  });

  it("finance totals use partial payout remaining for commission rows", () => {
    const commissions: CommissionRow[] = [
      {
        id: "c1",
        title: "Task",
        amount: 300,
        date: "2026-06-01",
        implementer: "Peter",
        payment_status: "unpaid",
        source_type: "task",
        source_id: "t1",
      } as CommissionRow,
    ];
    const totals = buildImplementerFinanceTotalsWithRentals(commissions, [
      {
        source_table: "commissions",
        source_id: "c1",
        amount: 100,
        paid_at: "2026-06-15T12:00:00Z",
        truth_level: "payout_fact",
        implementer: "Peter",
      },
    ], {
      websites: [],
      payments: [],
      allCommissions: commissions,
      year: 2026,
    });
    const peter = totals.get("Peter");
    expect(peter?.paidAudited).toBe(100);
    expect(peter?.unpaid).toBe(200);
  });
});
