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
  it("user can access finance only", () => {
    expect(canAccessRoute("/admin/finance", "user")).toBe(true);
    expect(canAccessRoute("/admin/rentals", "user")).toBe(false);
    expect(canAccessRoute("/admin/settings", "user")).toBe(false);
  });

  it("admin can access operational routes", () => {
    expect(canAccessRoute("/admin/rentals", "admin")).toBe(true);
    expect(isAdminOnlyRoute("/admin/clients")).toBe(true);
  });

  it("redirects user to finance", () => {
    expect(redirectPathForRole("user")).toBe("/admin/finance");
  });
});

describe("rc6.5 scoped empty states", () => {
  it("explains missing team profile", () => {
    const msg = resolveScopedCommissionEmpty({
      role: "user",
      userId: "u1",
      implementerName: null,
    });
    expect(userMissingTeamProfile({ role: "user", userId: "u1", implementerName: null })).toBe(true);
    expect(msg.reason).toBe("missing_profile");
    expect(msg.title).toContain("priradené");
  });
});
