import { describe, expect, it, vi, beforeEach } from "vitest";

const signOut = vi.fn().mockResolvedValue(undefined);
const getSession = vi.fn();
const getUser = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession, getUser, signOut },
  },
}));

describe("clearStaleAuthSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signs out when local session exists but getUser returns no user", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "x" } } });
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "invalid" } });

    const { clearStaleAuthSession } = await import("@/lib/auth/clearStaleAuthSession");
    const cleared = await clearStaleAuthSession();

    expect(cleared).toBe(true);
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("keeps session when getUser succeeds", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "x" } } });
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    const { clearStaleAuthSession } = await import("@/lib/auth/clearStaleAuthSession");
    const cleared = await clearStaleAuthSession();

    expect(cleared).toBe(false);
    expect(signOut).not.toHaveBeenCalled();
  });
});
