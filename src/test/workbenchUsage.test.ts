import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getWorkbenchUsageRows,
  getWorkbenchUsageTotal,
  recordWorkbenchUsage,
} from "@/lib/customerWorkbench/usageTracking";

describe("workbench usage tracking", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("records tab and quick-create counters without PII", () => {
    recordWorkbenchUsage("tab", "financie");
    recordWorkbenchUsage("tab", "financie");
    recordWorkbenchUsage("quick_create", "task");

    const rows = getWorkbenchUsageRows();
    expect(getWorkbenchUsageTotal()).toBe(3);
    expect(rows.find((r) => r.kind === "tab" && r.value === "financie")?.count).toBe(2);
    expect(rows.find((r) => r.kind === "quick_create" && r.value === "task")?.count).toBe(1);
  });

  it("ignores storage failures gracefully", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => recordWorkbenchUsage("tab", "prehlad")).not.toThrow();
    vi.restoreAllMocks();
  });
});
