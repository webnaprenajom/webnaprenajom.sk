import { describe, expect, it } from "vitest";
import { canAccessRoute, isAdminOnlyRoute, redirectPathForRole } from "@/lib/rbac/routeAccess";

const OWNER_ONLY_PATHS = ["/admin/settings", "/admin/debug", "/admin/communication-ops"];

const ADMINISTRATOR_ALLOWED = [
  "/admin",
  "/admin/today",
  "/admin/clients",
  "/admin/rentals",
  "/admin/commissions",
  "/admin/finance",
];

describe("rc6.6 route guards", () => {
  it("blocks administrator from owner-only paths", () => {
    for (const path of OWNER_ONLY_PATHS) {
      expect(canAccessRoute(path, "administrator")).toBe(false);
      expect(isAdminOnlyRoute(path)).toBe(true);
    }
  });

  it("allows administrator operational CRM paths", () => {
    for (const path of ADMINISTRATOR_ALLOWED) {
      expect(canAccessRoute(path, "administrator")).toBe(true);
    }
  });

  it("allows owner everywhere", () => {
    expect(canAccessRoute("/admin/rentals", "owner")).toBe(true);
    expect(canAccessRoute("/admin/settings", "owner")).toBe(true);
  });

  it("redirects administrator to today", () => {
    expect(redirectPathForRole("administrator")).toBe("/admin/today");
  });
});
