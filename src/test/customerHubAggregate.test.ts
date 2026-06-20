import { describe, it, expect } from "vitest";
import { fetchSection, mergeSectionErrors } from "@/lib/customerWorkbench/sectionFetch";
import { buildCustomerTimelineEvents } from "@/lib/customerWorkbench/timeline";
import {
  computeCustomerMrr,
  computeCustomerRiskBadges,
  computeCustomerType,
  computeWorkbenchSummary,
} from "@/lib/customerWorkbench/summary";
import type { CustomerWorkbenchData } from "@/lib/customerWorkbench/types";

const emptyData = (overrides: Partial<CustomerWorkbenchData> = {}): CustomerWorkbenchData => ({
  canonicalCustomer: null,
  viewMode: "email",
  leads: [],
  tasks: [],
  rentals: [],
  signatures: [],
  notes: [],
  marketing: [],
  hosting: [],
  wheels: [],
  designs: [],
  logs: [],
  commEvents: [],
  commissions: [],
  commLoadError: null,
  paymentRecords: [],
  costRecords: [],
  payoutRecords: [],
  rentalPayments: [],
  paymentRecordsError: null,
  costRecordsError: null,
  payoutRecordsError: null,
  ...overrides,
});

describe("fetchSection", () => {
  it("returns error instead of silent empty on Supabase failure", async () => {
    const result = await fetchSection(
      "test",
      async () => ({ data: null, error: { message: "permission denied" } }),
      [] as string[],
    );
    expect(result.data).toEqual([]);
    expect(result.error).toBe("test: permission denied");
    expect(result.loaded).toBe(true);
  });

  it("returns data on success", async () => {
    const result = await fetchSection(
      "test",
      async () => ({ data: ["a"], error: null }),
      [] as string[],
    );
    expect(result.data).toEqual(["a"]);
    expect(result.error).toBeNull();
  });

  it("catches thrown errors", async () => {
    const result = await fetchSection(
      "test",
      async () => {
        throw new Error("network down");
      },
      [] as string[],
    );
    expect(result.error).toBe("test: network down");
  });
});

describe("mergeSectionErrors", () => {
  it("joins multiple errors", () => {
    expect(mergeSectionErrors("a", null, "b")).toBe("a; b");
    expect(mergeSectionErrors(null, undefined)).toBeNull();
  });
});

describe("CustomerWorkbenchData finance errors", () => {
  it("surfaces payment/cost/payout section errors on workbench payload", () => {
    const data = emptyData({
      paymentRecordsError: "payments: permission denied",
      costRecordsError: "costs: timeout",
      payoutRecordsError: null,
    });
    expect(data.paymentRecordsError).toBe("payments: permission denied");
    expect(data.costRecordsError).toBe("costs: timeout");
    expect(data.payoutRecordsError).toBeNull();
  });
});

describe("hasAnyData fix", () => {
  it("returns true when only payment records exist", () => {
    const data = emptyData({
      paymentRecords: [
        {
          id: "p1",
          source_table: null,
          source_id: null,
          customer_email: "x@test.sk",
          client_name: "X",
          rental_website_id: null,
          amount: 100,
          currency: "EUR",
          paid_at: "2026-01-01",
          method: null,
          reference: null,
          note: null,
          truth_level: "payment_fact",
        },
      ],
    });
    const summary = computeWorkbenchSummary(data, "x@test.sk");
    expect(summary.hasAnyData).toBe(true);
  });
});

describe("computeCustomerMrr", () => {
  it("sums active rental and hosting monthly prices", () => {
    const data = emptyData({
      rentals: [
        { id: "r1", name: "A", url: null, monthly_price: 30, implementers: null, client_name: "X" },
        { id: "r2", name: "B", url: null, monthly_price: 20, implementers: null, client_name: "X" },
      ],
      hosting: [
        {
          id: "h1",
          client_name: "X",
          provider: "Wedos",
          monthly_price: 5,
          yearly_price: null,
          domains_count: 1,
          active: true,
          created_at: "2026-01-01",
        },
        {
          id: "h2",
          client_name: "X",
          provider: "Old",
          monthly_price: 10,
          yearly_price: null,
          domains_count: 0,
          active: false,
          created_at: "2026-01-01",
        },
      ],
    });
    expect(computeCustomerMrr(data)).toBe(55);
  });
});

describe("computeCustomerType", () => {
  it("detects rental-only vs mixed", () => {
    expect(
      computeCustomerType(
        emptyData({
          rentals: [{ id: "r1", name: "A", url: null, monthly_price: 10, implementers: null, client_name: "X" }],
        }),
      ),
    ).toBe("rental_only");
    expect(
      computeCustomerType(
        emptyData({
          rentals: [{ id: "r1", name: "A", url: null, monthly_price: 10, implementers: null, client_name: "X" }],
          notes: [{ id: "n1", title: "P", client_name: "X", url: null, status: "in_progress", has_credentials: false }],
        }),
      ),
    ).toBe("mixed");
  });
});

describe("computeCustomerRiskBadges", () => {
  it("flags overdue rental payments and unpaid commissions", () => {
    const data = emptyData({
      rentalPayments: [
        {
          id: "rp1",
          website_id: "r1",
          month: 1,
          year: 2026,
          amount: 30,
          custom_price: null,
          paid: false,
          status: "unpaid",
          paid_at: null,
        },
      ],
      commissions: [
        { id: "c1", title: "Prov", amount: 50, payment_status: "unpaid", date: "2026-01-01" },
      ],
    });
    const summary = computeWorkbenchSummary(data, "x@test.sk");
    const badges = computeCustomerRiskBadges(data, summary);
    expect(badges.some((b) => b.id === "overdue-rental")).toBe(true);
    expect(badges.some((b) => b.id === "unpaid-commissions")).toBe(true);
  });
});

describe("buildCustomerTimelineEvents — finance events", () => {
  it("includes payment and payout events", () => {
    const data = emptyData({
      paymentRecords: [
        {
          id: "p1",
          source_table: null,
          source_id: null,
          customer_email: "x@test.sk",
          client_name: "X",
          rental_website_id: "r1",
          amount: 100,
          currency: "EUR",
          paid_at: "2026-05-01",
          method: "bank",
          reference: null,
          note: null,
          truth_level: "payment_fact",
        },
      ],
      payoutRecords: [
        {
          id: "po1",
          source_table: "commissions",
          source_id: "c1",
          implementer: "Realizator",
          amount: 15,
          currency: "EUR",
          paid_at: "2026-05-05",
          reference: null,
          note: null,
          truth_level: "payout_fact",
        },
      ],
      rentalPayments: [
        {
          id: "rp1",
          website_id: "r1",
          month: 6,
          year: 2026,
          amount: 30,
          custom_price: null,
          paid: false,
          status: "unpaid",
          paid_at: null,
        },
      ],
    });
    const events = buildCustomerTimelineEvents(data);
    expect(events.some((e) => e.id === "payment-p1")).toBe(true);
    expect(events.some((e) => e.id === "payout-po1")).toBe(true);
    expect(events.some((e) => e.id === "rental-pay-rp1")).toBe(true);
    expect(events.filter((e) => e.category === "finance").length).toBeGreaterThanOrEqual(3);
    expect(events.find((e) => e.id === "payment-p1")?.truthLevel).toBe("payment_fact");
    expect(events.find((e) => e.id === "payout-po1")?.truthLevel).toBe("payout_fact");
    expect(events.find((e) => e.id === "rental-pay-rp1")?.truthLevel).toBe("workflow_only");
  });

  it("marks commission timeline as workflow and uses explicit status copy", () => {
    const data = emptyData({
      commissions: [
        { id: "c1", title: "Prov", amount: 50, payment_status: "paid", date: "2026-01-01" },
      ],
      payoutRecords: [],
    });
    const event = buildCustomerTimelineEvents(data).find((e) => e.id === "comm-c1");
    expect(event?.truthLevel).toBe("workflow_only");
    expect(event?.detail).toContain("workflow");
  });
});
