import { describe, it, expect } from "vitest";
import {
  classifyTaskLink,
  compareTaskLinkStrength,
  planTaskCustomerBackfill,
  summarizeOpenTasks,
} from "@/lib/crmLookup/taskCustomerLink";

describe("classifyTaskLink", () => {
  it("prefers customer_id over lead_id", () => {
    expect(
      classifyTaskLink({
        customer_id: "550e8400-e29b-41d4-a716-446655440000",
        lead_id: "lead-1",
        client_name: "Acme",
      }),
    ).toBe("customer_id");
  });

  it("falls back to lead_id then client_name", () => {
    expect(classifyTaskLink({ lead_id: "l1", client_name: "X" })).toBe("lead_id");
    expect(classifyTaskLink({ client_name: "X" })).toBe("client_name");
    expect(classifyTaskLink({})).toBe("unlinked");
  });
});

describe("compareTaskLinkStrength", () => {
  it("orders customer before legacy links", () => {
    expect(compareTaskLinkStrength("customer_id", "lead_id")).toBeLessThan(0);
    expect(compareTaskLinkStrength("client_name", "customer_id")).toBeGreaterThan(0);
  });
});

describe("planTaskCustomerBackfill", () => {
  const leads = new Map([
    ["l1", { id: "l1", customer_id: "c1" }],
    ["l2", { id: "l2", customer_id: null }],
  ]);

  it("proposes customer only from lead with customer_id", () => {
    const plans = planTaskCustomerBackfill(
      [
        { id: "t1", lead_id: "l1", customer_id: null, client_name: "A" },
        { id: "t2", lead_id: "l2", customer_id: null, client_name: "B" },
        { id: "t3", lead_id: null, customer_id: null, client_name: "C" },
        { id: "t4", lead_id: "l1", customer_id: "c9", client_name: "D" },
      ],
      leads,
    );
    expect(plans.find((p) => p.taskId === "t1")).toEqual({
      taskId: "t1",
      proposedCustomerId: "c1",
      reason: "lead_customer_id",
    });
    expect(plans.find((p) => p.taskId === "t2")?.reason).toBe("lead_without_customer");
    expect(plans.find((p) => p.taskId === "t3")?.reason).toBe("no_lead_id");
    expect(plans.find((p) => p.taskId === "t4")?.reason).toBe("already_linked");
  });
});

describe("summarizeOpenTasks", () => {
  it("counts customer-linked open tasks", () => {
    const stats = summarizeOpenTasks([
      { status: "todo", customer_id: "c1" },
      { status: "todo", customer_id: null },
      { status: "done", customer_id: null },
    ]);
    expect(stats.openTotal).toBe(2);
    expect(stats.customerLinked).toBe(1);
    expect(stats.legacyOnly).toBe(1);
  });
});
