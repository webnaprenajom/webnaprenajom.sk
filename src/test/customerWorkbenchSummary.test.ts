import { describe, it, expect } from "vitest";
import {
  applyWorkbenchUrlUpdate,
  parseWorkbenchCommFilter,
  parseWorkbenchTab,
} from "@/lib/customerWorkbench/urlState";
import {
  computeCustomerFinanceSummary,
  computeRecommendedActions,
  computeUnresolvedIssues,
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
  credentials: [],
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

describe("workbench URL state", () => {
  it("defaults tab and comm filter", () => {
    const params = new URLSearchParams();
    expect(parseWorkbenchTab(params)).toBe("prehlad");
    expect(parseWorkbenchCommFilter(params)).toBe("all");
  });

  it("parses tab and comm filter from URL", () => {
    const params = new URLSearchParams("tab=komunikacia&comm=inbound");
    expect(parseWorkbenchTab(params)).toBe("komunikacia");
    expect(parseWorkbenchCommFilter(params)).toBe("inbound");
  });

  it("parses hesla tab for customer credentials", () => {
    expect(parseWorkbenchTab(new URLSearchParams("tab=hesla"))).toBe("hesla");
  });

  it("counts credentials in hasAnyData", () => {
    expect(computeWorkbenchSummary(emptyData(), "x@y.sk").hasAnyData).toBe(false);
    expect(
      computeWorkbenchSummary(
        emptyData({
          credentials: [
            {
              id: "c1",
              category: "web_admin",
              label: "Admin",
              url: null,
              login: "a",
              password: "p",
              note: null,
              linked_entity_type: null,
              linked_entity_id: null,
              customer_id: "cust-1",
              customer_email: "x@y.sk",
              client_name: "X",
              updated_at: "2026-06-01",
            },
          ],
        }),
        "x@y.sk",
      ).hasAnyData,
    ).toBe(true);
  });

  it("omits default params when updating URL", () => {
    const next = applyWorkbenchUrlUpdate(new URLSearchParams("tab=financie&comm=outbound"), {
      tab: "prehlad",
    });
    expect(next.get("tab")).toBeNull();
    expect(next.get("comm")).toBeNull();
  });

  it("clears comm filter when leaving komunikacia tab", () => {
    const next = applyWorkbenchUrlUpdate(new URLSearchParams("tab=komunikacia&comm=threaded"), {
      tab: "ulohy",
    });
    expect(next.get("tab")).toBe("ulohy");
    expect(next.get("comm")).toBeNull();
  });

  it("sets comm filter only when non-all", () => {
    const next = applyWorkbenchUrlUpdate(new URLSearchParams(), {
      tab: "komunikacia",
      commFilter: "unlinked",
    });
    expect(next.get("tab")).toBe("komunikacia");
    expect(next.get("comm")).toBe("unlinked");
  });
});

describe("computeWorkbenchSummary", () => {
  it("counts open tasks and unpaid commissions", () => {
    const data = emptyData({
      tasks: [
        {
          id: "t1",
          title: "Legacy",
          status: "todo",
          amount: 0,
          deposit: 0,
          due_date: null,
          updated_at: "2026-01-01",
          client_name: "X",
          lead_id: "l1",
          customer_id: null,
          matchedBy: "lead_id",
        },
      ],
      leads: [{ id: "l1", name: "Lead", email: "a@b.cz", phone: null, status: "new", source: null, assigned_to: null, temperature: null, created_at: "2026-01-01" }],
      commissions: [
        {
          id: "c1",
          title: "Prov",
          amount: 100,
          payment_status: "unpaid",
          date: "2026-01-01",
        },
        {
          id: "c2",
          title: "Paid",
          amount: 50,
          payment_status: "paid",
          date: "2026-01-01",
        },
      ],
      notes: [{ id: "n1", title: "P", client_name: "X", url: null, status: "in_progress", has_credentials: false }],
    });

    const summary = computeWorkbenchSummary(data, "client@test.sk");
    expect(summary.openTasksCount).toBe(1);
    expect(summary.openTasksCustomerLinked).toBe(0);
    expect(summary.openTasksLegacyOnly).toBe(1);
    expect(summary.unpaidCommissionsCount).toBe(1);
    expect(summary.unpaidCommissionsTotal).toBe(100);
    expect(summary.activeProjectsCount).toBe(1);
    expect(summary.hasAnyData).toBe(true);
  });

  it("detects overdue tasks", () => {
    const data = emptyData({
      tasks: [
        {
          id: "t1",
          title: "Late",
          status: "todo",
          amount: 0,
          deposit: 0,
          due_date: "2020-01-01",
          updated_at: "2026-01-01",
          client_name: "X",
          lead_id: null,
          customer_id: null,
          matchedBy: "client_name",
        },
      ],
    });
    const summary = computeWorkbenchSummary(data, "x@test.sk");
    expect(summary.overdueTasksCount).toBe(1);
  });
});

describe("computeRecommendedActions", () => {
  it("prioritizes warnings before open lead", () => {
    const data = emptyData({
      leads: [{ id: "l1", name: "Lead", email: "a@b.cz", phone: null, status: "new", source: null, assigned_to: null, temperature: null, created_at: "2026-01-01" }],
      commissions: [{ id: "c1", title: "X", amount: 10, payment_status: "unpaid", date: "2026-01-01" }],
    });
    const summary = computeWorkbenchSummary(data, "a@b.cz");
    const actions = computeRecommendedActions(data, summary);
    expect(actions[0].id).toBe("finance");
    expect(actions.some((a) => a.id === "open-lead")).toBe(true);
  });

  it("does not suggest add-note when communication events exist", () => {
    const data = emptyData({
      commEvents: [
        {
          id: "ce1",
          customer_id: "c1",
          customer_email: "a@b.cz",
          sender_email: null,
          recipient_email: null,
          kind: "note",
          title: "Note",
          body_preview: "Hi",
          metadata: {},
          source_table: null,
          source_id: null,
          message_id: null,
          in_reply_to: null,
          thread_id: null,
          occurred_at: "2026-06-01T10:00:00Z",
          created_at: "2026-06-01T10:00:00Z",
        },
      ],
      canonicalCustomer: {
        id: "c1",
        display_name: "Client",
        email: "a@b.cz",
        metadata: {},
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      },
      viewMode: "id",
    });
    const summary = computeWorkbenchSummary(data, "c1");
    const actions = computeRecommendedActions(data, summary);
    expect(actions.some((a) => a.id === "add-note")).toBe(false);
  });

  it("suggests add-note only when no comm events and email known", () => {
    const data = emptyData({
      canonicalCustomer: {
        id: "c1",
        display_name: "Client",
        email: "a@b.cz",
        metadata: {},
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      },
      viewMode: "id",
    });
    const summary = computeWorkbenchSummary(data, "c1");
    const actions = computeRecommendedActions(data, summary);
    expect(actions.some((a) => a.id === "add-note")).toBe(true);
  });

  it("returns all-clear when nothing to do", () => {
    const data = emptyData({
      leads: [],
      commEvents: [
        {
          id: "ce1",
          customer_id: "c1",
          customer_email: "a@b.cz",
          sender_email: null,
          recipient_email: null,
          kind: "email_out",
          title: "Out",
          body_preview: null,
          metadata: {},
          source_table: null,
          source_id: null,
          message_id: null,
          in_reply_to: null,
          thread_id: null,
          occurred_at: "2026-06-01T10:00:00Z",
          created_at: "2026-06-01T10:00:00Z",
        },
      ],
      canonicalCustomer: {
        id: "c1",
        display_name: "Client",
        email: "a@b.cz",
        metadata: {},
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      },
      viewMode: "id",
    });
    const summary = computeWorkbenchSummary(data, "c1");
    const actions = computeRecommendedActions(data, summary);
    expect(actions).toHaveLength(1);
    expect(actions[0].id).toBe("all-clear");
  });

  it("never includes contradictory overview fallback with warnings", () => {
    const data = emptyData({
      commEvents: [
        {
          id: "in1",
          customer_id: null,
          customer_email: "unknown@test.sk",
          sender_email: "unknown@test.sk",
          recipient_email: null,
          kind: "email_in",
          title: "Re",
          body_preview: null,
          metadata: {},
          source_table: null,
          source_id: null,
          message_id: null,
          in_reply_to: null,
          thread_id: null,
          occurred_at: "2026-06-01T10:00:00Z",
          created_at: "2026-06-01T10:00:00Z",
        },
      ],
    });
    const summary = computeWorkbenchSummary(data, "unknown@test.sk");
    const actions = computeRecommendedActions(data, summary);
    expect(actions.some((a) => a.id === "reconcile")).toBe(true);
    expect(actions.some((a) => a.id === "all-clear")).toBe(false);
    expect(actions.some((a) => a.id === "add-note")).toBe(false);
  });
});

describe("computeCustomerFinanceSummary", () => {
  it("splits payments and costs by truth level and computes gross/net profit", () => {
    const data = emptyData({
      rentals: [
        { id: "r1", name: "web1.sk", url: null, monthly_price: 30, implementers: null, client_name: "X" },
      ],
      paymentRecords: [
        {
          id: "p1",
          source_table: "rental_payments",
          source_id: "rp1",
          customer_email: "client@test.sk",
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
        {
          id: "p2",
          source_table: "legacy",
          source_id: null,
          customer_email: "client@test.sk",
          client_name: "X",
          rental_website_id: "r1",
          amount: 50,
          currency: "EUR",
          paid_at: "2026-04-01",
          method: null,
          reference: null,
          note: null,
          truth_level: "legacy_import",
        },
      ],
      costRecords: [
        {
          id: "c1",
          source_table: "cost_records",
          source_id: null,
          category: "hosting",
          vendor: "Wedos",
          client_name: "X",
          rental_website_id: "r1",
          amount: 20,
          currency: "EUR",
          paid_at: "2026-05-01",
          incurred_at: "2026-05-01",
          reference: null,
          note: null,
          truth_level: "cost_fact",
        },
      ],
      rentalPayments: [
        {
          id: "rp1",
          website_id: "r1",
          month: 5,
          year: 2026,
          amount: 30,
          custom_price: null,
          paid: true,
          status: "paid",
          paid_at: "2026-05-01",
        },
        {
          id: "rp2",
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
      payoutRecords: [
        {
          id: "po1",
          source_table: "commissions",
          source_id: "comm1",
          implementer: "Realizator A",
          amount: 15,
          currency: "EUR",
          paid_at: "2026-05-05",
          reference: null,
          note: null,
          truth_level: "payout_fact",
        },
      ],
    });

    const finance = computeCustomerFinanceSummary(data);
    expect(finance.paymentsReceivedTotal).toBe(100);
    expect(finance.paymentsReceivedFactTotal).toBe(100);
    expect(finance.paymentsReceivedLegacyTotal).toBe(50);
    expect(finance.paymentsExpectedTotal).toBe(30);
    expect(finance.costsTotal).toBe(20);
    expect(finance.costsFactTotal).toBe(20);
    expect(finance.grossProfit.canShowProfit).toBe(true);
    expect(finance.grossProfit.profit).toBe(80);
    expect(finance.paidCommissionsTotal).toBe(15);
    expect(finance.paidCommissionsByImplementer).toEqual([
      { implementer: "Realizator A", total: 15, count: 1 },
    ]);
    expect(finance.netProfitCanShow).toBe(true);
    expect(finance.netProfit).toBe(65);
  });

  it("does not show profit when there is no revenue and no cost", () => {
    const data = emptyData();
    const finance = computeCustomerFinanceSummary(data);
    expect(finance.paymentsReceivedTotal).toBe(0);
    expect(finance.grossProfit.canShowProfit).toBe(false);
    expect(finance.grossProfit.status).toBe("no_revenue_yet");
    expect(finance.netProfitCanShow).toBe(false);
    expect(finance.netProfit).toBeNull();
    expect(finance.paidCommissionsByImplementer).toEqual([]);
  });

  it("does not show profit when costs exist but payment_records are missing", () => {
    const data = emptyData({
      costRecords: [
        {
          id: "c1",
          source_table: null,
          source_id: null,
          category: "hosting",
          vendor: "Wedos",
          client_name: "X",
          rental_website_id: null,
          amount: 40,
          currency: "EUR",
          paid_at: "2026-05-01",
          incurred_at: "2026-05-01",
          reference: null,
          note: null,
          truth_level: "cost_fact",
        },
      ],
    });
    const finance = computeCustomerFinanceSummary(data);
    expect(finance.costsTotal).toBe(40);
    expect(finance.grossProfit.canShowProfit).toBe(false);
    expect(finance.grossProfit.status).toBe("cost_without_revenue");
  });
});

describe("computeUnresolvedIssues", () => {
  it("flags heuristic view and unlinked inbound", () => {
    const data = emptyData({
      viewMode: "email",
      commEvents: [
        {
          id: "in1",
          customer_id: null,
          customer_email: "x@test.sk",
          sender_email: "x@test.sk",
          recipient_email: null,
          kind: "email_in",
          title: "Hi",
          body_preview: null,
          metadata: {},
          source_table: null,
          source_id: null,
          message_id: null,
          in_reply_to: null,
          thread_id: null,
          occurred_at: "2026-06-01",
          created_at: "2026-06-01",
        },
      ],
    });
    const summary = computeWorkbenchSummary(data, "x@test.sk");
    const issues = computeUnresolvedIssues(data, summary);
    expect(issues.some((i) => i.includes("Heuristický"))).toBe(true);
    expect(issues.some((i) => i.includes("customer_id"))).toBe(true);
  });

  it("flags tier-3 client_name hub fallback", () => {
    const data = emptyData({ usedClientNameFallback: true });
    const summary = computeWorkbenchSummary(data, "x@test.sk");
    const issues = computeUnresolvedIssues(data, summary);
    expect(issues.some((i) => i.includes("len podľa mena klienta"))).toBe(true);
  });
});
