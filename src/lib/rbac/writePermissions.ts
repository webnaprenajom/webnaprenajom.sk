/**
 * Write permission helpers (Batch RC6.6) — align UI with DB/RLS (admin-only mutations).
 */

import type { AccessContext } from "@/lib/rbac/permissions";
import { commissionVisibleToUser } from "@/lib/rbac/permissions";

export function canWriteCommissions(ctx: AccessContext): boolean {
  return ctx.role === "admin";
}

export function canEditOperatingCosts(ctx: AccessContext): boolean {
  return ctx.role === "admin";
}

export function canManageTeamProfiles(ctx: AccessContext): boolean {
  return ctx.role === "admin";
}

export function canManageUserRoles(ctx: AccessContext): boolean {
  return ctx.role === "admin";
}

export function canMutateFinanceRecords(ctx: AccessContext): boolean {
  return ctx.role === "admin";
}

export function canToggleCommissionPaymentStatus(
  ctx: AccessContext,
  implementer: string | null | undefined,
): boolean {
  if (ctx.role === "admin") return true;
  return false;
}

export function canEditCommissionRow(
  ctx: AccessContext,
  row: { implementer?: string | null },
): boolean {
  if (!canWriteCommissions(ctx)) return false;
  return commissionVisibleToUser(row.implementer, ctx);
}

export function writeDeniedMessage(action: string): string {
  return `${action} môže vykonať len administrátor.`;
}
