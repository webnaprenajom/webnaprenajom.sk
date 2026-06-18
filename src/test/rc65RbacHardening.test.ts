import { describe, expect, it } from "vitest";
import {
  canAccessRoute,
  isAdminOnlyRoute,
  redirectPathForRole,
} from "@/lib/rbac/routeAccess";
import {
  resolveScopedCommissionEmpty,
  userMissingTeamProfile,
} from "@/lib/rbac/permissions";

describe("rc6.5 route access", () => {
  it("administrator can access operational CRM routes", () => {
    expect(canAccessRoute("/admin/finance", "administrator")).toBe(true);
    expect(canAccessRoute("/admin/rentals", "administrator")).toBe(true);
    expect(canAccessRoute("/admin/clients", "administrator")).toBe(true);
    expect(canAccessRoute("/admin/settings", "administrator")).toBe(false);
    expect(canAccessRoute("/admin/debug", "administrator")).toBe(false);
  });

  it("owner can access operational routes", () => {
    expect(canAccessRoute("/admin/rentals", "owner")).toBe(true);
    expect(isAdminOnlyRoute("/admin/clients")).toBe(true);
  });

  it("redirects administrator to today", () => {
    expect(redirectPathForRole("administrator")).toBe("/admin/today");
  });
});

describe("rc6.5 scoped empty states", () => {
  it("explains missing team profile", () => {
    const msg = resolveScopedCommissionEmpty({
      role: "administrator",
      userId: "u1",
      implementerName: null,
    });
    expect(
      userMissingTeamProfile({ role: "administrator", userId: "u1", implementerName: null }),
    ).toBe(true);
    expect(msg.reason).toBe("missing_profile");
    expect(msg.title).toContain("priradené");
  });
});
