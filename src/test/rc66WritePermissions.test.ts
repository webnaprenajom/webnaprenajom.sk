import { describe, expect, it } from "vitest";
import {
  canEditOperatingCosts,
  canManageUserRoles,
  canToggleCommissionPaymentStatus,
  canConfirmCommissionPayoutReceipt,
  canWriteCommissions,
} from "@/lib/rbac/writePermissions";

const owner = { role: "owner" as const, userId: "a1", implementerName: null };
const administrator = { role: "administrator" as const, userId: "u1", implementerName: "Peter" };
const noRole = { role: null, userId: "x1", implementerName: "Peter" };

describe("rc6.6 write permissions", () => {
  it("denies administrator full commission CRUD helpers", () => {
    expect(canWriteCommissions(administrator)).toBe(false);
    expect(canEditOperatingCosts(administrator)).toBe(false);
    expect(canManageUserRoles(administrator)).toBe(false);
  });

  it("allows owner mutations", () => {
    expect(canWriteCommissions(owner)).toBe(true);
    expect(canEditOperatingCosts(owner)).toBe(true);
    expect(canManageUserRoles(owner)).toBe(true);
    expect(canToggleCommissionPaymentStatus(owner, "Peter")).toBe(true);
    expect(canToggleCommissionPaymentStatus(owner, "Maroš")).toBe(true);
  });

  it("allows administrator payment_status toggle only for own implementer", () => {
    expect(canToggleCommissionPaymentStatus(administrator, "Peter")).toBe(true);
    expect(canToggleCommissionPaymentStatus(administrator, "Maroš")).toBe(false);
  });

  it("denies payment_status toggle without CRM role", () => {
    expect(canToggleCommissionPaymentStatus(noRole, "Peter")).toBe(false);
  });

  it("owner cannot confirm payout receipt — only earning realizator", () => {
    expect(canConfirmCommissionPayoutReceipt(owner, "Peter")).toBe(false);
    expect(canConfirmCommissionPayoutReceipt(administrator, "Peter")).toBe(true);
    expect(canConfirmCommissionPayoutReceipt(administrator, "Maroš")).toBe(false);
  });
});
