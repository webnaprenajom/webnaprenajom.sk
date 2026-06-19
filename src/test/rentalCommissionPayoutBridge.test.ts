import { describe, expect, it } from "vitest";
import {
  findRentalWorkflowCommission,
  toPayoutBridgeCommission,
} from "@/lib/finance/rentalCommissionPayoutBridge";
import type { CommissionRow } from "@/lib/commissionSource";

function row(partial: Partial<CommissionRow> & { id: string }): CommissionRow {
  return {
    title: "Test",
    amount: 100,
    date: "2026-06-01",
    implementer: "Jan",
    payment_status: "unpaid",
    ...partial,
  } as CommissionRow;
}

describe("rentalCommissionPayoutBridge", () => {
  it("finds rental commission by website, implementer and year", () => {
    const commissions = [
      row({
        id: "c1",
        source_type: "rental",
        source_id: "web-1",
        implementer: "Jan",
        date: "2026-03-15",
      }),
      row({
        id: "c2",
        source_type: "rental",
        source_id: "web-1",
        implementer: "Eva",
        date: "2026-01-01",
      }),
      row({
        id: "c3",
        source_type: "rental",
        source_id: "web-2",
        implementer: "Jan",
        date: "2025-12-01",
      }),
    ];
    expect(
      findRentalWorkflowCommission(commissions, {
        websiteId: "web-1",
        implementer: "Jan",
        year: 2026,
      })?.id,
    ).toBe("c1");
    expect(
      findRentalWorkflowCommission(commissions, {
        websiteId: "web-1",
        implementer: "Jan",
        year: 2025,
      }),
    ).toBeNull();
  });

  it("maps commission row to payout bridge shape", () => {
    expect(
      toPayoutBridgeCommission({
        id: "c-9",
        title: "Site",
        amount: 42.5,
        date: "2026-06-01",
        implementer: "Peter",
        note: "x",
      }),
    ).toEqual({
      id: "c-9",
      title: "Site",
      amount: 42.5,
      date: "2026-06-01",
      implementer: "Peter",
      note: "x",
    });
  });
});
