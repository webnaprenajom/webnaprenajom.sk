import { describe, expect, it, vi, beforeEach } from "vitest";
import { bulkDeleteLeads, formatBulkLeadDeleteSummary } from "@/lib/destructive/bulkLeadDelete";

vi.mock("@/lib/destructive/client", () => ({
  precheckDestructiveDelete: vi.fn(),
  executeDestructiveDelete: vi.fn(),
}));

import { executeDestructiveDelete, precheckDestructiveDelete } from "@/lib/destructive/client";

const precheck = vi.mocked(precheckDestructiveDelete);
const execute = vi.mocked(executeDestructiveDelete);

function leadImpact(isRisky: boolean) {
  return {
    entity_type: "lead" as const,
    entity_id: "x",
    entity_label: "X",
    can_delete: true,
    finance_critical: isRisky,
    sections: [],
    lead_impact: { is_risky: isRisky, sections: [] },
    warnings: [],
    blocking_records: [],
    cta_links: [],
  };
}

beforeEach(() => {
  precheck.mockReset();
  execute.mockReset();
});

describe("bulkDeleteLeads", () => {
  it("deletes allowed leads and skips risky", async () => {
    precheck
      .mockResolvedValueOnce({ impact: leadImpact(false), error: null })
      .mockResolvedValueOnce({ impact: leadImpact(true), error: null })
      .mockResolvedValueOnce({ impact: leadImpact(false), error: null });
    execute.mockResolvedValue({ result: { ok: true, entity_type: "lead", entity_id: "a", deleted: { leads: 1 }, detached: {} }, error: null });

    const result = await bulkDeleteLeads(["a", "b", "c"]);
    expect(result.deleted).toEqual(["a", "c"]);
    expect(result.skipped).toEqual(["b"]);
    expect(result.failed).toEqual([]);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("records precheck failures as failed, not skipped", async () => {
    precheck.mockResolvedValueOnce({ impact: null, error: "insufficient_privileges" });
    const result = await bulkDeleteLeads(["x"]);
    expect(result.failed).toHaveLength(1);
    expect(result.skipped).toEqual([]);
    expect(execute).not.toHaveBeenCalled();
  });

  it("continues after execute failure", async () => {
    precheck.mockResolvedValue({ impact: leadImpact(false), error: null });
    execute
      .mockResolvedValueOnce({ result: null, error: "network" })
      .mockResolvedValueOnce({ result: { ok: true, entity_type: "lead", entity_id: "b", deleted: { leads: 1 }, detached: {} }, error: null });

    const result = await bulkDeleteLeads(["a", "b"]);
    expect(result.failed).toEqual([{ id: "a", reason: "network" }]);
    expect(result.deleted).toEqual(["b"]);
  });
});

describe("formatBulkLeadDeleteSummary", () => {
  it("aggregates deleted, skipped, failed counts", () => {
    const text = formatBulkLeadDeleteSummary({
      deleted: ["1", "2"],
      skipped: ["3"],
      failed: [{ id: "4", reason: "err" }],
    });
    expect(text).toContain("Zmazaných: 2");
    expect(text).toContain("Preskočených: 1");
    expect(text).toContain("Zlyhalo: 1");
  });
});
