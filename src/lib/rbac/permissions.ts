/**
 * App RBAC helpers (Batch RC6).
 */

export type AppRole = "admin" | "user";

export type AccessContext = {
  role: AppRole | null;
  userId: string | null;
  implementerName: string | null;
};

export function isCrmUser(role: AppRole | null): boolean {
  return role === "admin" || role === "user";
}

export function canAccessSettings(role: AppRole | null): boolean {
  return role === "admin";
}

export function canManageUsers(role: AppRole | null): boolean {
  return role === "admin";
}

export function canSeeAllCommissions(role: AppRole | null): boolean {
  return role === "admin";
}

export function canAccessFinanceAdvanced(role: AppRole | null): boolean {
  return role === "admin";
}

/** Match commission row to logged-in user (case-insensitive implementer name). */
export function commissionVisibleToUser(
  implementer: string | null | undefined,
  ctx: AccessContext,
): boolean {
  if (ctx.role === "admin") return true;
  if (ctx.role !== "user" || !ctx.implementerName) return false;
  return (implementer || "").trim().toLowerCase() === ctx.implementerName.trim().toLowerCase();
}

export function filterCommissionsForUser<T extends { implementer?: string | null }>(
  rows: T[],
  ctx: AccessContext,
): T[] {
  if (canSeeAllCommissions(ctx.role)) return rows;
  return rows.filter((r) => commissionVisibleToUser(r.implementer, ctx));
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

/** Role=user without team_profiles.implementer_name — RLS hides all commissions. */
export function userMissingTeamProfile(ctx: AccessContext): boolean {
  return ctx.role === "user" && !ctx.implementerName?.trim();
}

export function canAccessOperationalCrm(role: AppRole | null): boolean {
  return role === "admin";
}

export function canAccessAdminDiagnostics(role: AppRole | null): boolean {
  return role === "admin";
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
  if (ctx.role === "user") {
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
