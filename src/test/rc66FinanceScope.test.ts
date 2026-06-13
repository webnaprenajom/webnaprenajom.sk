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
  const userCtx = {
    role: "user" as const,
    userId: "u1",
    implementerName: "Alice",
  };

  it("role=user cannot access org-wide finance advanced tools", () => {
    expect(canAccessFinanceAdvanced("user")).toBe(false);
    expect(canAccessOperationalCrm("user")).toBe(false);
    expect(canAccessFinanceAdvanced("admin")).toBe(true);
  });

  it("role=user sees only own implementer commissions", () => {
    const scoped = filterCommissionsForUser(sampleCommissions, userCtx);
    expect(scoped).toHaveLength(2);
    expect(scoped.every((r) => commissionVisibleToUser(r.implementer, userCtx))).toBe(true);
    expect(scoped.some((r) => r.implementer === "Bob")).toBe(false);
  });

  it("role=user implementer totals exclude other implementers", () => {
    const scoped = filterCommissionsForUser(sampleCommissions, userCtx);
    const totals = implementerTotalsFromCommissions(scoped);
    expect(totals.has("Bob")).toBe(false);
    expect(totals.has("Alice") || totals.has("alice")).toBe(true);
  });

  it("admin sees all commission rows", () => {
    const adminCtx = { role: "admin" as const, userId: "a1", implementerName: null };
    expect(filterCommissionsForUser(sampleCommissions, adminCtx)).toHaveLength(3);
  });
});
