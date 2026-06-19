/**
 * App RBAC helpers (Batch RC6 / Phase 4a owner-administrator).
 */

import { filterForUser, rowVisibleToUser } from "@/lib/rbac/scopeHelpers";

export type AppRole = "owner" | "administrator";

/** Legacy DB enum values kept for backward compat until all callers migrate. */
export type LegacyAppRole = "admin" | "user";

export type AccessContext = {
  role: AppRole | null;
  userId: string | null;
  implementerName: string | null;
};

export type PermissionFlags = {
  canAccessOperationalCrm: boolean;
  canAccessFinanceAdvanced: boolean;
  canSeeAllCommissions: boolean;
  canAccessAdminDiagnostics: boolean;
  canSeeAllClients: boolean;
  canSeeAllLeads: boolean;
  canSeeAllTasks: boolean;
  canSeeAllHosting: boolean;
  canSeeAllRentals: boolean;
  canSeeAllProjects: boolean;
  canSeeAllMarketing: boolean;
  canSeeAllPasswords: boolean;
  canSeeAllDesigns: boolean;
};

/** Normalize DB role row (owner/administrator or legacy admin/user). */
export function normalizeAppRole(raw: string | null | undefined): AppRole | null {
  const value = raw?.trim();
  if (value === "owner" || value === "admin") return "owner";
  if (value === "administrator" || value === "user") return "administrator";
  return null;
}

/** Pick CRM role from user_roles rows — owner wins when both are present. */
export function resolveAppRoleFromRows(roleValues: string[]): AppRole | null {
  const normalized = roleValues
    .map(normalizeAppRole)
    .filter((role): role is AppRole => role != null);
  if (normalized.includes("owner")) return "owner";
  if (normalized.includes("administrator")) return "administrator";
  return null;
}

export function isOwner(role: AppRole | null): boolean {
  return role === "owner";
}

export function isAdministrator(role: AppRole | null): boolean {
  return role === "administrator";
}

export function isCrmUser(role: AppRole | null): boolean {
  return role === "owner" || role === "administrator";
}

export function resolvePermissions(role: AppRole | null): PermissionFlags {
  const all = isOwner(role);
  const crm = isCrmUser(role);
  return {
    canAccessOperationalCrm: crm,
    canAccessFinanceAdvanced: all,
    canSeeAllCommissions: all,
    canAccessAdminDiagnostics: all,
    canSeeAllClients: all,
    canSeeAllLeads: all,
    canSeeAllTasks: all,
    canSeeAllHosting: all,
    canSeeAllRentals: all,
    canSeeAllProjects: all,
    canSeeAllMarketing: all,
    canSeeAllPasswords: all,
    canSeeAllDesigns: all,
  };
}

export function canAccessSettings(role: AppRole | null): boolean {
  return isOwner(role);
}

export function canManageUsers(role: AppRole | null): boolean {
  return isOwner(role);
}

export function canSeeAllCommissions(role: AppRole | null): boolean {
  return resolvePermissions(role).canSeeAllCommissions;
}

export function canAccessFinanceAdvanced(role: AppRole | null): boolean {
  return resolvePermissions(role).canAccessFinanceAdvanced;
}

/** Match commission row to logged-in user (case-insensitive implementer name). */
export function commissionVisibleToUser(
  implementer: string | null | undefined,
  ctx: AccessContext,
): boolean {
  if (isOwner(ctx.role)) return true;
  if (!isAdministrator(ctx.role)) return false;
  return rowVisibleToUser({ implementerName: implementer }, ctx);
}

export function filterCommissionsForUser<T extends { implementer?: string | null }>(
  rows: T[],
  ctx: AccessContext,
): T[] {
  if (canSeeAllCommissions(ctx.role)) return rows;
  return filterForUser(rows, ctx, (row) => ({ implementerName: row.implementer }));
}

export function filterPayoutRecordsForUser<T extends { implementer?: string | null }>(
  rows: T[],
  ctx: AccessContext,
): T[] {
  if (canSeeAllCommissions(ctx.role)) return rows;
  return filterForUser(rows, ctx, (row) => ({ implementerName: row.implementer }));
}

export function commissionTotalsFromRows(
  rows: Array<{ amount?: number | null; payment_status?: string | null }>,
): { paid: number; unpaid: number; count: number } {
  let paid = 0;
  let unpaid = 0;
  for (const c of rows) {
    const amt = Number(c.amount || 0);
    if (c.payment_status === "paid") paid += amt;
    else unpaid += amt;
  }
  return { paid, unpaid, count: rows.length };
}

export function implementerTotalsFromCommissions(
  rows: Array<{ implementer?: string | null; amount?: number | null; payment_status?: string | null }>,
): Map<string, { paid: number; unpaid: number; count: number }> {
  const map = new Map<string, { paid: number; unpaid: number; count: number }>();
  for (const c of rows) {
    const key = (c.implementer || "").trim();
    if (!key) continue;
    const cur = map.get(key) || { paid: 0, unpaid: 0, count: 0 };
    const amt = Number(c.amount || 0);
    if (c.payment_status === "paid") cur.paid += amt;
    else cur.unpaid += amt;
    cur.count += 1;
    map.set(key, cur);
  }
  return map;
}

/** Role=administrator without team_profiles.implementer_name — RLS hides all commissions. */
export function userMissingTeamProfile(ctx: AccessContext): boolean {
  return isAdministrator(ctx.role) && !ctx.implementerName?.trim();
}

export function canAccessOperationalCrm(role: AppRole | null): boolean {
  return resolvePermissions(role).canAccessOperationalCrm;
}

export function canAccessAdminDiagnostics(role: AppRole | null): boolean {
  return resolvePermissions(role).canAccessAdminDiagnostics;
}

export type ScopedEmptyReason = "no_data" | "missing_profile" | "scoped_empty";

export function resolveScopedCommissionEmpty(ctx: AccessContext): {
  reason: ScopedEmptyReason;
  title: string;
  body: string;
} {
  if (userMissingTeamProfile(ctx)) {
    return {
      reason: "missing_profile",
      title: "Provízie nie sú priradené k vášmu účtu",
      body:
        "Správca musí v Nastaveniach → Správa používateľov prepojiť váš účet s menom realizátora (team profile). Bez toho systém nevie, ktoré provízie vám zobraziť.",
    };
  }
  if (isAdministrator(ctx.role)) {
    return {
      reason: "scoped_empty",
      title: "Zatiaľ žiadne vaše provízie",
      body: `Pre realizátora „${ctx.implementerName}“ nie sú v systéme provízne záznamy, alebo ešte neboli načítané.`,
    };
  }
  return {
    reason: "no_data",
    title: "Žiadne provízne záznamy",
    body: "V databáze zatiaľ nie sú provízie pre zobrazenie.",
  };
}

export function accessContextFromState(state: {
  role: AppRole | null;
  userId: string | null;
  implementerName: string | null;
}): AccessContext {
  return {
    role: state.role,
    userId: state.userId,
    implementerName: state.implementerName,
  };
}
