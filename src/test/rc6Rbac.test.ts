import { describe, expect, it } from "vitest";
import {
  canAccessSettings,
  commissionTotalsFromRows,
  commissionVisibleToUser,
  filterCommissionsForUser,
  isCrmUser,
} from "@/lib/rbac/permissions";

describe("rc6 RBAC", () => {
  it("recognizes CRM roles", () => {
    expect(isCrmUser("admin")).toBe(true);
    expect(isCrmUser("user")).toBe(true);
    expect(isCrmUser(null)).toBe(false);
  });

  it("restricts settings to admin", () => {
    expect(canAccessSettings("admin")).toBe(true);
    expect(canAccessSettings("user")).toBe(false);
  });

  it("filters commissions for user by implementer name", () => {
    const rows = [
      { implementer: "Peter", amount: 10 },
      { implementer: "Maroš", amount: 20 },
    ];
    const ctx = { role: "user" as const, userId: "u1", implementerName: "Peter" };
    expect(filterCommissionsForUser(rows, ctx)).toHaveLength(1);
    expect(filterCommissionsForUser(rows, { ...ctx, role: "admin" })).toHaveLength(2);
  });

  it("matches implementer case-insensitively", () => {
    const ctx = { role: "user" as const, userId: "u1", implementerName: "peter" };
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
