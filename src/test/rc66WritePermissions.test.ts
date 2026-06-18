import { describe, expect, it } from "vitest";
import {
  canEditOperatingCosts,
  canManageUserRoles,
  canToggleCommissionPaymentStatus,
  canWriteCommissions,
} from "@/lib/rbac/writePermissions";

const owner = { role: "owner" as const, userId: "a1", implementerName: null };
const administrator = { role: "administrator" as const, userId: "u1", implementerName: "Peter" };

describe("rc6.6 write permissions", () => {
  it("denies administrator all mutation helpers", () => {
    expect(canWriteCommissions(administrator)).toBe(false);
    expect(canEditOperatingCosts(administrator)).toBe(false);
    expect(canManageUserRoles(administrator)).toBe(false);
    expect(canToggleCommissionPaymentStatus(administrator, "Peter")).toBe(false);
  });

  it("allows owner mutations", () => {
    expect(canWriteCommissions(owner)).toBe(true);
    expect(canEditOperatingCosts(owner)).toBe(true);
    expect(canManageUserRoles(owner)).toBe(true);
    expect(canToggleCommissionPaymentStatus(owner, "Peter")).toBe(true);
  });
});
