import { describe, expect, it } from "vitest";
import {
  PAYMENT_COMPLETENESS_LABELS,
  reconciliationAgreedPriceDetail,
  resolvePaymentCompleteness,
  remainingToPay,
  enrichDealPayment,
} from "@/lib/finance/paymentCompleteness";
import { computeCustomerFinanceSummary } from "@/lib/customerWorkbench/summary";
import type { CustomerWorkbenchData } from "@/lib/customerWorkbench/types";

describe("resolvePaymentCompleteness", () => {
  it("agreed=1000, confirmed=0 → bez platby", () => {
    const pc = resolvePaymentCompleteness(1000, 0);
    expect(pc.status).toBe("unpaid");
    expect(pc.remaining).toBe(1000);
    expect(PAYMENT_COMPLETENESS_LABELS[pc.status]).toBe("Bez platby");
  });

  it("agreed=1000, confirmed=400 → čiastočne uhradené", () => {
    const pc = resolvePaymentCompleteness(1000, 400);
    expect(pc.status).toBe("partial");
    expect(pc.remaining).toBe(600);
    expect(remainingToPay(1000, 400)).toBe(600);
  });

  it("agreed=1000, confirmed=1000 → plne uhradené", () => {
    const pc = resolvePaymentCompleteness(1000, 1000);
    expect(pc.status).toBe("paid");
    expect(pc.overpaid).toBe(0);
  });

  it("agreed=1000, confirmed=1200 → plne uhradené + overpaid detail", () => {
    const pc = resolvePaymentCompleteness(1000, 1200);
    expect(pc.status).toBe("paid");
    expect(pc.overpaid).toBe(200);
  });

  it("agreed missing, confirmed=0 → bez dohodnutej ceny", () => {
    const pc = resolvePaymentCompleteness(null, 0);
    expect(pc.status).toBe("no_agreed_price");
  });

  it("reconciliation detail for partial payment", () => {
    const pc = resolvePaymentCompleteness(1000, 400);
    expect(reconciliationAgreedPriceDetail("Projekt", pc)).toMatch(/nedoplatok 600/i);
  });
});

describe("enrichDealPayment", () => {
  it("uses only payment_fact rows for confirmed sum", () => {
    const pc = enrichDealPayment(
      1000,
      [
        {
          source_table: "project_notes",
          source_id: "p-1",
          amount: 400,
          truth_level: "payment_fact",
        },
        {
          source_table: "project_notes",
          source_id: "p-1",
          amount: 600,
          truth_level: "legacy_import",
        },
      ],
      "project_notes",
      "p-1",
    );
    expect(pc.status).toBe("partial");
    expect(pc.confirmedPaid).toBe(400);
  });
});

describe("computeCustomerFinanceSummary confirmed cash", () => {
  const base = {
    canonicalCustomer: null,
    viewMode: "email" as const,
    leads: [],
    tasks: [],
    rentals: [],
    signatures: [],
    notes: [],
    marketing: [],
    hosting: [],
    credentials: [],
    wheels: [],
    designs: [],
    logs: [],
    commEvents: [],
    commissions: [],
    commLoadError: null,
    costRecords: [],
    payoutRecords: [],
    rentalPayments: [],
  };

  it("uses only payment_fact for paymentsReceivedTotal and gross profit", () => {
    const data: CustomerWorkbenchData = {
      ...base,
      paymentRecords: [
        {
          id: "f1",
          source_table: "project_notes",
          source_id: "p1",
          customer_email: "a@b.sk",
          client_name: "A",
          rental_website_id: null,
          amount: 400,
          currency: "EUR",
          paid_at: "2026-06-01",
          method: null,
          reference: null,
          note: null,
          truth_level: "payment_fact",
        },
        {
          id: "l1",
          source_table: "legacy",
          source_id: null,
          customer_email: "a@b.sk",
          client_name: "A",
          rental_website_id: null,
          amount: 1000,
          currency: "EUR",
          paid_at: "2026-05-01",
          method: null,
          reference: null,
          note: null,
          truth_level: "legacy_import",
        },
      ],
    };
    const finance = computeCustomerFinanceSummary(data);
    expect(finance.paymentsReceivedTotal).toBe(400);
    expect(finance.paymentsReceivedFactTotal).toBe(400);
    expect(finance.paymentsReceivedLegacyTotal).toBe(1000);
    expect(finance.grossProfit.revenue).toBe(400);
  });

  it("legacy_import alone does not count as confirmed cash", () => {
    const data: CustomerWorkbenchData = {
      ...base,
      paymentRecords: [
        {
          id: "l1",
          source_table: "legacy",
          source_id: null,
          customer_email: "a@b.sk",
          client_name: "A",
          rental_website_id: null,
          amount: 1000,
          currency: "EUR",
          paid_at: "2026-05-01",
          method: null,
          reference: null,
          note: null,
          truth_level: "legacy_import",
        },
      ],
    };
    const finance = computeCustomerFinanceSummary(data);
    expect(finance.paymentsReceivedTotal).toBe(0);
    expect(finance.grossProfit.canShowProfit).toBe(false);
  });
});
