import { describe, expect, it } from "vitest";
import {
  canAccessSettings,
  commissionTotalsFromRows,
  commissionVisibleToUser,
  filterCommissionsForUser,
  isCrmUser,
  isOwner,
  normalizeAppRole,
  resolveAppRoleFromRows,
  resolvePermissions,
} from "@/lib/rbac/permissions";

describe("rc6 RBAC", () => {
  it("normalizes legacy and canonical DB role strings", () => {
    expect(normalizeAppRole("owner")).toBe("owner");
    expect(normalizeAppRole("admin")).toBe("owner");
    expect(normalizeAppRole("administrator")).toBe("administrator");
    expect(normalizeAppRole("user")).toBe("administrator");
    expect(normalizeAppRole(" guest ")).toBe(null);
  });

  it("resolves owner before administrator from role rows", () => {
    expect(resolveAppRoleFromRows(["administrator", "owner"])).toBe("owner");
    expect(resolveAppRoleFromRows(["user"])).toBe("administrator");
    expect(resolveAppRoleFromRows(["admin"])).toBe("owner");
    expect(resolveAppRoleFromRows([])).toBe(null);
  });
  it("recognizes CRM roles", () => {
    expect(isCrmUser("owner")).toBe(true);
    expect(isCrmUser("administrator")).toBe(true);
    expect(isCrmUser(null)).toBe(false);
  });

  it("restricts settings to owner", () => {
    expect(canAccessSettings("owner")).toBe(true);
    expect(canAccessSettings("administrator")).toBe(false);
  });

  it("owner has all canSeeAll flags", () => {
    const perms = resolvePermissions("owner");
    expect(perms.canAccessOperationalCrm).toBe(true);
    expect(perms.canAccessFinanceAdvanced).toBe(true);
    expect(perms.canSeeAllCommissions).toBe(true);
    expect(perms.canSeeAllClients).toBe(true);
    expect(isOwner("owner")).toBe(true);
  });

  it("administrator has scoped visibility flags", () => {
    const perms = resolvePermissions("administrator");
    expect(perms.canAccessOperationalCrm).toBe(true);
    expect(perms.canAccessFinanceAdvanced).toBe(false);
    expect(perms.canSeeAllCommissions).toBe(false);
    expect(perms.canSeeAllClients).toBe(false);
  });

  it("filters commissions for administrator by implementer name", () => {
    const rows = [
      { implementer: "Peter", amount: 10 },
      { implementer: "Maroš", amount: 20 },
    ];
    const ctx = { role: "administrator" as const, userId: "u1", implementerName: "Peter" };
    expect(filterCommissionsForUser(rows, ctx)).toHaveLength(1);
    expect(filterCommissionsForUser(rows, { ...ctx, role: "owner" })).toHaveLength(2);
  });

  it("matches implementer case-insensitively", () => {
    const ctx = { role: "administrator" as const, userId: "u1", implementerName: "peter" };
    expect(commissionVisibleToUser("Peter", ctx)).toBe(true);
    expect(commissionVisibleToUser("Maroš", ctx)).toBe(false);
  });

  it("totals paid vs unpaid from payment_status", () => {
    const t = commissionTotalsFromRows([
      { amount: 100, payment_status: "paid" },
      { amount: 50, payment_status: "unpaid" },
      { amount: 25, payment_status: "unpaid" },
    ]);
    expect(t.paid).toBe(100);
    expect(t.unpaid).toBe(75);
    expect(t.count).toBe(3);
  });
});
