import { describe, expect, it } from "vitest";
import { canAccessRoute, isAdminOnlyRoute, redirectPathForRole } from "@/lib/rbac/routeAccess";

const ADMIN_PATHS = [
  "/admin",
  "/admin/today",
  "/admin/clients",
  "/admin/rentals",
  "/admin/settings",
  "/admin/commissions",
  "/admin/debug",
  "/admin/communication-ops",
];

const USER_ALLOWED = ["/admin/finance"];

describe("rc6.6 route guards", () => {
  it("blocks user from all admin operational paths", () => {
    for (const path of ADMIN_PATHS) {
      expect(canAccessRoute(path, "user")).toBe(false);
      expect(isAdminOnlyRoute(path)).toBe(true);
    }
  });

  it("allows user only finance", () => {
    for (const path of USER_ALLOWED) {
      expect(canAccessRoute(path, "user")).toBe(true);
    }
  });

  it("allows admin everywhere", () => {
    expect(canAccessRoute("/admin/rentals", "admin")).toBe(true);
    expect(canAccessRoute("/admin/settings", "admin")).toBe(true);
  });

  it("redirects user to finance", () => {
    expect(redirectPathForRole("user")).toBe("/admin/finance");
  });
});
