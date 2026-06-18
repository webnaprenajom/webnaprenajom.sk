import { describe, expect, it } from "vitest";
import {
  canAccessFinanceAdvanced,
  canAccessOperationalCrm,
  commissionVisibleToUser,
  filterCommissionsForUser,
  implementerTotalsFromCommissions,
} from "@/lib/rbac/permissions";

const sampleCommissions = [
  { id: "1", implementer: "Alice", amount: 100, payment_status: "paid" },
  { id: "2", implementer: "Bob", amount: 200, payment_status: "unpaid" },
  { id: "3", implementer: "alice", amount: 50, payment_status: "paid" },
];

describe("rc6.6 finance scope (negative cases)", () => {
  const administratorCtx = {
    role: "administrator" as const,
    userId: "u1",
    implementerName: "Alice",
  };

  it("administrator cannot access org-wide finance advanced tools", () => {
    expect(canAccessFinanceAdvanced("administrator")).toBe(false);
    expect(canAccessOperationalCrm("administrator")).toBe(true);
    expect(canAccessFinanceAdvanced("owner")).toBe(true);
  });

  it("administrator sees only own implementer commissions", () => {
    const scoped = filterCommissionsForUser(sampleCommissions, administratorCtx);
    expect(scoped).toHaveLength(2);
    expect(scoped.every((r) => commissionVisibleToUser(r.implementer, administratorCtx))).toBe(true);
    expect(scoped.some((r) => r.implementer === "Bob")).toBe(false);
  });

  it("administrator implementer totals exclude other implementers", () => {
    const scoped = filterCommissionsForUser(sampleCommissions, administratorCtx);
    const totals = implementerTotalsFromCommissions(scoped);
    expect(totals.has("Bob")).toBe(false);
    expect(totals.has("Alice") || totals.has("alice")).toBe(true);
  });

  it("owner sees all commission rows", () => {
    const ownerCtx = { role: "owner" as const, userId: "a1", implementerName: null };
    expect(filterCommissionsForUser(sampleCommissions, ownerCtx)).toHaveLength(3);
  });
});
