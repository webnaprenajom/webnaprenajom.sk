/**
 * Write permission helpers (Batch RC6.6 / Phase 4a) — align UI with DB/RLS.
 */

import type { AccessContext } from "@/lib/rbac/permissions";
import { commissionVisibleToUser, isAdministrator, isOwner } from "@/lib/rbac/permissions";

export function canWriteCommissions(ctx: AccessContext): boolean {
  return isOwner(ctx.role);
}

export function canEditOperatingCosts(ctx: AccessContext): boolean {
  return isOwner(ctx.role);
}

export function canManageTeamProfiles(ctx: AccessContext): boolean {
  return isOwner(ctx.role);
}

export function canManageUserRoles(ctx: AccessContext): boolean {
  return isOwner(ctx.role);
}

export function canMutateFinanceRecords(ctx: AccessContext): boolean {
  return isOwner(ctx.role);
}

export function canToggleCommissionPaymentStatus(
  ctx: AccessContext,
  implementer: string | null | undefined,
): boolean {
  if (isOwner(ctx.role)) return true;
  if (!isAdministrator(ctx.role)) return false;
  return commissionVisibleToUser(implementer, ctx);
}

export function commissionPaymentStatusDeniedMessage(): string {
  return "Stav úhrady môže meniť owner (všetky provízie) alebo realizátor len na svojich províziách.";
}

export function canEditCommissionRow(
  ctx: AccessContext,
  row: { implementer?: string | null },
): boolean {
  if (!canWriteCommissions(ctx)) return false;
  return commissionVisibleToUser(row.implementer, ctx);
}

export function writeDeniedMessage(action: string): string {
  return `${action} môže vykonať len owner.`;
}
