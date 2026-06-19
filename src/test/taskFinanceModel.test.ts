import { describe, expect, it } from "vitest";
import {
  isLegacyTaskFinance,
  normalizeTaskFinancePayload,
  taskParentLinkError,
  taskStatusOptionsForForm,
} from "@/lib/tasks/taskFinanceModel";

describe("taskFinanceModel", () => {
  it("detects legacy finance by amount, deposit or billing status", () => {
    expect(isLegacyTaskFinance({ amount: 100, deposit: 0, status: "todo" })).toBe(true);
    expect(isLegacyTaskFinance({ amount: 0, deposit: 50, status: "todo" })).toBe(true);
    expect(isLegacyTaskFinance({ amount: 0, deposit: 0, status: "deposit_received" })).toBe(true);
    expect(isLegacyTaskFinance({ amount: 0, deposit: 0, status: "in_progress" })).toBe(false);
  });

  it("offers finance statuses only for legacy edit", () => {
    expect(taskStatusOptionsForForm(null)).not.toContain("paid");
    expect(
      taskStatusOptionsForForm({ status: "paid", amount: 500, deposit: 0 }),
    ).toContain("paid");
  });

  it("strips finance fields on save for non-legacy tasks", () => {
    expect(
      normalizeTaskFinancePayload({ status: "paid", amount: 100, deposit: 20 }),
    ).toEqual({ status: "todo", amount: 0, deposit: 0 });
    expect(
      normalizeTaskFinancePayload(
        { status: "done", amount: 999, deposit: 1 },
        { status: "paid", amount: 500, deposit: 100 },
      ),
    ).toEqual({ status: "done", amount: 500, deposit: 100 });
  });

  it("requires parent link fields", () => {
    expect(taskParentLinkError({})).toBeTruthy();
    expect(taskParentLinkError({ client_name: "ACME" })).toBeNull();
    expect(taskParentLinkError({ lead_id: "l-1" })).toBeNull();
  });
});
