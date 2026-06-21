import { describe, expect, it } from "vitest";
import {
  buildCommissionPayoutFactDraft,
  buildCommissionPayoutDraft,
  buildPartialCommissionPayoutDraft,
  commissionHasLinkedPayoutInRows,
  shouldOfferCommissionPayoutFact,
} from "@/lib/finance/commissionPayoutBridge";

describe("commissionPayoutBridge", () => {
  it("offers dialog only when marking paid without linked payout", () => {
    expect(shouldOfferCommissionPayoutFact("unpaid", "paid", false)).toBe(true);
    expect(shouldOfferCommissionPayoutFact("unpaid", "paid", true)).toBe(false);
    expect(shouldOfferCommissionPayoutFact("paid", "unpaid", false)).toBe(false);
    expect(shouldOfferCommissionPayoutFact("paid", "paid", false)).toBe(false);
  });

  it("detects linked payout in loaded rows", () => {
    const rows = [
      { source_table: "commissions", source_id: "c-1" },
      { source_table: "commissions", source_id: "c-2" },
    ];
    expect(commissionHasLinkedPayoutInRows("c-1", rows)).toBe(true);
    expect(commissionHasLinkedPayoutInRows("c-9", rows)).toBe(false);
  });

  it("builds payout draft for marketing/task commissions", () => {
    const draft = buildCommissionPayoutFactDraft({
      id: "c-marketing",
      title: "Kampaň Google",
      implementer: "Peter",
      amount: 120,
      date: "2026-06-15",
      note: null,
    });
    expect(draft).toMatchObject({
      kind: "payout",
      amount: "120",
      implementer: "Peter",
      source_table: "commissions",
      source_id: "c-marketing",
    });
  });

  it("builds partial payout draft from remaining potential", () => {
    const draft = buildPartialCommissionPayoutDraft(
      {
        id: "c1",
        title: "Prenájom",
        implementer: "Peter",
        amount: 300,
        date: "2026-12-31",
        note: null,
      },
      100,
      { potentialAmount: 300 },
    );
    expect(draft).toMatchObject({
      kind: "payout",
      amount: "200",
      source_table: "commissions",
      source_id: "c1",
      implementer: "Peter",
    });
    expect(draft?.paid_at).toBeTruthy();
  });

  it("buildCommissionPayoutDraft does not throw (toLocalInput import)", () => {
    const draft = buildCommissionPayoutDraft({
      id: "c1",
      title: "Test",
      implementer: "A",
      amount: 50,
      date: "2026-01-01",
      note: "note",
    });
    expect(draft.amount).toBe("50");
  });
});
