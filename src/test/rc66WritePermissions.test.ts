import { describe, expect, it } from "vitest";
import {
  canEditOperatingCosts,
  canManageUserRoles,
  canToggleCommissionPaymentStatus,
  canWriteCommissions,
} from "@/lib/rbac/writePermissions";

const admin = { role: "admin" as const, userId: "a1", implementerName: null };
const user = { role: "user" as const, userId: "u1", implementerName: "Peter" };

describe("rc6.6 write permissions", () => {
  it("denies user all mutation helpers", () => {
    expect(canWriteCommissions(user)).toBe(false);
    expect(canEditOperatingCosts(user)).toBe(false);
    expect(canManageUserRoles(user)).toBe(false);
    expect(canToggleCommissionPaymentStatus(user, "Peter")).toBe(false);
  });

  it("allows admin mutations", () => {
    expect(canWriteCommissions(admin)).toBe(true);
    expect(canEditOperatingCosts(admin)).toBe(true);
    expect(canManageUserRoles(admin)).toBe(true);
    expect(canToggleCommissionPaymentStatus(admin, "Peter")).toBe(true);
  });
});
