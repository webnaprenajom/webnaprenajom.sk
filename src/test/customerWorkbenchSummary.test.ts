import { describe, it, expect } from "vitest";
import {
  applyWorkbenchUrlUpdate,
  parseWorkbenchCommFilter,
  parseWorkbenchTab,
} from "@/lib/customerWorkbench/urlState";
import {
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
  hosting: [],
  wheels: [],
  designs: [],
  logs: [],
  commEvents: [],
  commissions: [],
  commLoadError: null,
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
});
