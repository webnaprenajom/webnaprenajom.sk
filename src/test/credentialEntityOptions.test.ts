import { beforeEach, describe, expect, it, vi } from "vitest";

const { ilike, eq, select, from } = vi.hoisted(() => {
  const ilike = vi.fn(async () => ({ data: [], error: null }));
  const eq = vi.fn(async () => ({ data: [], error: null }));
  const select = vi.fn(() => ({ eq, ilike }));
  const from = vi.fn(() => ({ select }));
  return { ilike, eq, select, from };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from },
}));

import { loadCredentialEntityOptions } from "@/lib/customerCredentialsSave";

describe("loadCredentialEntityOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ilike.mockResolvedValue({ data: [], error: null });
    eq.mockResolvedValue({ data: [], error: null });
    select.mockImplementation(() => ({ eq, ilike }));
  });

  it("uses client_name fallback when canonical FK is absent", async () => {
    ilike.mockImplementation(async (_col: string, val: string) => {
      if (val === "Legacy Klient") {
        return {
          data: [{ id: "proj-legacy", title: "Starý projekt" }],
          error: null,
        };
      }
      return { data: [], error: null };
    });

    const opts = await loadCredentialEntityOptions(null, null, "Legacy Klient");

    expect(from).toHaveBeenCalledWith("project_notes");
    expect(ilike).toHaveBeenCalledWith("client_name", "Legacy Klient");
    expect(opts.project).toEqual([{ id: "proj-legacy", label: "Starý projekt" }]);
  });

  it("prefers customer_id path and skips client_name when FK is present", async () => {
    eq.mockResolvedValue({ data: [{ id: "p1", title: "Via FK" }], error: null });

    await loadCredentialEntityOptions("cust-1", "a@b.sk", "Legacy Klient");

    expect(eq).toHaveBeenCalledWith("customer_id", "cust-1");
    expect(ilike).not.toHaveBeenCalledWith("client_name", "Legacy Klient");
  });
});
