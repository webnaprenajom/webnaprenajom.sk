import { describe, expect, it } from "vitest";
import {
  buildPayoutEditDraft,
  canMutatePayoutRecord,
  parsePayoutRecordReference,
  recomputeDealPayoutFromTransactions,
} from "@/lib/finance/commissionPayoutMutations";
import {
  deriveDealPayoutStatus,
  payoutTransactionsForCommission,
  sumPayoutTransactions,
} from "@/lib/finance/rentalCommissionDeal";

describe("commissionPayoutMutations", () => {
  it("allows mutate only for payout_fact", () => {
    expect(canMutatePayoutRecord("payout_fact")).toBe(true);
    expect(canMutatePayoutRecord("legacy_import")).toBe(false);
    expect(canMutatePayoutRecord(null)).toBe(false);
  });

  it("parses merged reference back to form and bank ref", () => {
    expect(parsePayoutRecordReference("Cash · VS123")).toEqual({
      paymentForm: "Cash",
      bankRef: "VS123",
    });
    expect(parsePayoutRecordReference("VS123")).toEqual({
      paymentForm: "",
      bankRef: "VS123",
    });
  });

  it("builds edit draft with recordId", () => {
    const draft = buildPayoutEditDraft({
      id: "p1",
      amount: 50,
      paid_at: "2026-06-15T10:00:00.000Z",
      implementer: "Peter",
      reference: "Cash · VS1",
      note: "test",
      source_table: "commissions",
      source_id: "c1",
      truth_level: "payout_fact",
    });
    expect(draft.recordId).toBe("p1");
    expect(draft.amount).toBe("50");
    expect(draft.reference).toBe("Cash");
    expect(draft.method).toBe("VS1");
  });

  it("recomputes deal totals after editing one partial payout", () => {
    const records = [
      {
        id: "p1",
        source_table: "commissions",
        source_id: "c1",
        amount: 40,
        paid_at: "2026-06-01",
        truth_level: "payout_fact",
      },
      {
        id: "p2",
        source_table: "commissions",
        source_id: "c1",
        amount: 30,
        paid_at: "2026-06-02",
        truth_level: "payout_fact",
      },
    ];
    const txs = payoutTransactionsForCommission("c1", records);
    expect(sumPayoutTransactions(txs)).toBe(70);
    expect(deriveDealPayoutStatus(100, sumPayoutTransactions(txs))).toBe("partially_paid");

    const afterEdit = recomputeDealPayoutFromTransactions(100, [{ amount: 60 }, { amount: 30 }]);
    expect(afterEdit.paid).toBe(90);
    expect(afterEdit.remaining).toBe(10);
    expect(afterEdit.status).toBe("partially_paid");
  });

  it("recomputes to unpaid after deleting only payout", () => {
    const afterDelete = recomputeDealPayoutFromTransactions(200, []);
    expect(afterDelete.paid).toBe(0);
    expect(afterDelete.remaining).toBe(200);
    expect(afterDelete.status).toBe("unpaid");
  });

  it("detects overpaid after edit increases payout total", () => {
    const over = recomputeDealPayoutFromTransactions(100, [{ amount: 120 }]);
    expect(over.status).toBe("overpaid");
    expect(deriveDealPayoutStatus(100, 120)).toBe("overpaid");
  });
});
