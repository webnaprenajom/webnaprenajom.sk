import { describe, expect, it, vi, beforeEach } from "vitest";
import { executeLeadDelete, precheckLeadDelete } from "@/lib/leads/destructive";

vi.mock("@/lib/destructive/client", () => ({
  precheckDestructiveDelete: vi.fn(),
  executeDestructiveDelete: vi.fn(),
}));

import {
  executeDestructiveDelete,
  precheckDestructiveDelete,
} from "@/lib/destructive/client";

describe("lead destructive client", () => {
  beforeEach(() => {
    vi.mocked(precheckDestructiveDelete).mockReset();
    vi.mocked(executeDestructiveDelete).mockReset();
  });

  it("precheckLeadDelete calls shared RPC with entity type lead", async () => {
    vi.mocked(precheckDestructiveDelete).mockResolvedValue({
      impact: { entity_type: "lead", entity_id: "x", can_delete: true } as never,
      error: null,
    });

    await precheckLeadDelete("lead-uuid");

    expect(precheckDestructiveDelete).toHaveBeenCalledWith("lead", "lead-uuid");
  });

  it("executeLeadDelete surfaces RPC errors", async () => {
    vi.mocked(executeDestructiveDelete).mockResolvedValue({
      result: null,
      error: "insufficient_privileges",
    });

    const { result, error } = await executeLeadDelete("lead-uuid");

    expect(executeDestructiveDelete).toHaveBeenCalledWith("lead", "lead-uuid");
    expect(result).toBeNull();
    expect(error).toBe("insufficient_privileges");
  });
});
