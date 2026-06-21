import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import {
  buildDraftKey,
  clearCrmDraft,
  loadCrmDraft,
  saveCrmDraft,
  CRM_DRAFT_TTL_MS,
  pruneStaleCrmDrafts,
} from "@/lib/crmPersistence/draftStore";
import {
  buildPilotRestoreKey,
  clearCrmViewState,
  saveCrmViewState,
  loadCrmViewState,
} from "@/lib/crmPersistence/viewRestoreStore";
import { crmStorageRemove } from "@/lib/crmPersistence/storage";

describe("crmPersistence draftStore", () => {
  beforeEach(() => {
    clearCrmDraft(buildDraftKey("test-modal", "abc"));
    crmStorageRemove("view:last");
  });

  it("round-trips draft data", () => {
    const key = buildDraftKey("test-modal", "abc");
    saveCrmDraft(key, {
      meta: {
        route: "/admin",
        modalId: "test-modal",
        entityId: "abc",
        updatedAt: Date.now(),
        dirty: true,
      },
      data: { notes: "hello" },
    });
    const loaded = loadCrmDraft<{ notes: string }>(key);
    expect(loaded?.data.notes).toBe("hello");
  });

  it("expires drafts past TTL", () => {
    const key = buildDraftKey("test-modal", "old");
    saveCrmDraft(key, {
      meta: {
        route: "/admin",
        modalId: "test-modal",
        entityId: "old",
        updatedAt: Date.now() - CRM_DRAFT_TTL_MS - 1000,
        dirty: true,
      },
      data: { x: 1 },
    });
    expect(loadCrmDraft(key)).toBeNull();
  });

  it("pruneStaleCrmDrafts removes expired entries", () => {
    const key = buildDraftKey("test-modal", "stale");
    saveCrmDraft(key, {
      meta: {
        route: "/admin",
        modalId: "test-modal",
        entityId: "stale",
        updatedAt: Date.now() - CRM_DRAFT_TTL_MS - 500,
        dirty: true,
      },
      data: {},
    });
    expect(pruneStaleCrmDrafts()).toBeGreaterThan(0);
    expect(loadCrmDraft(key)).toBeNull();
  });
});

describe("crmPersistence viewRestoreStore", () => {
  beforeEach(() => {
    clearCrmViewState();
  });

  it("save requires modalId", () => {
    saveCrmViewState({ route: "/admin" });
    expect(loadCrmViewState()).toBeNull();
    saveCrmViewState({ route: "/admin", modalId: "lead-detail", entityId: "x" });
    expect(loadCrmViewState()?.modalId).toBe("lead-detail");
  });

  it("buildPilotRestoreKey dedups snapshots", () => {
    const state = {
      route: "/admin",
      modalId: "lead-detail",
      entityId: "abc",
      updatedAt: 12345,
    };
    expect(buildPilotRestoreKey(state)).toBe("/admin:lead-detail:abc:12345");
  });

  it("view restore is mount-only — no visibilitychange handler in hook source", () => {
    const src = readFileSync(join(process.cwd(), "src/hooks/useCrmViewRestore.ts"), "utf8");
    expect(src).not.toContain("visibilitychange");
    expect(src).toContain("restoreAttemptedForRouteRef");
  });
});

describe("crm tab-return stability", () => {
  it("QueryClient disables focus/reconnect/mount refetch by default", () => {
    const src = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
    expect(src).toContain("refetchOnWindowFocus: false");
    expect(src).toContain("refetchOnReconnect: false");
    expect(src).toContain("refetchOnMount: false");
  });

  it("admin access ignores TOKEN_REFRESHED — no tab-return auth storm", () => {
    const src = readFileSync(join(process.cwd(), "src/hooks/useAdminAccess.ts"), "utf8");
    expect(src).not.toMatch(/event\s*===\s*["']TOKEN_REFRESHED["']/);
    expect(src).toContain("AdminAccessProvider");
  });

  it("admin routes wrap a single AdminAccessProvider", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/admin/rbac/ProtectedAdminOutlet.tsx"),
      "utf8",
    );
    expect(src).toContain("<AdminAccessProvider>");
  });
});

describe("useStableAccessLoad", () => {
  it("dedupes loads per userId+role key", async () => {
    const { renderHook } = await import("@testing-library/react");
    const { useStableAccessLoad } = await import("@/hooks/useStableAccessLoad");

    let calls = 0;
    const load = () => {
      calls += 1;
    };

    const { rerender } = renderHook(
      ({ authChecking, userId, role }) => {
        useStableAccessLoad(authChecking, userId, role, load);
      },
      { initialProps: { authChecking: true, userId: null as string | null, role: null as import("@/lib/rbac/permissions").AppRole | null } },
    );

    expect(calls).toBe(0);

    rerender({ authChecking: false, userId: "u1", role: "owner" });
    expect(calls).toBe(1);

    // Tab return / token refresh — same identity must not re-fetch
    rerender({ authChecking: false, userId: "u1", role: "owner" });
    expect(calls).toBe(1);

    rerender({ authChecking: false, userId: "u2", role: "owner" });
    expect(calls).toBe(2);
  });
});

describe("crmPersistence storage memory fallback", () => {
  it("reports availability in test env", async () => {
    const { crmStorageAvailable, crmStorageSet, crmStorageGet } = await import(
      "@/lib/crmPersistence/storage"
    );
    // jsdom usually allows localStorage
    expect(typeof crmStorageAvailable()).toBe("boolean");
    crmStorageSet("mem-test", "ok");
    expect(crmStorageGet("mem-test")).toBe("ok");
  });
});
