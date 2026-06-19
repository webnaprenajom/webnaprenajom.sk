import type { AppRole } from "@/lib/rbac/permissions";
import { isAdministrator, isOwner, normalizeAppRole } from "@/lib/rbac/permissions";

export type AuthDirectoryRow = {
  userId: string;
  email: string;
  authDisplayName: string | null;
  createdAt?: string;
};

export type CrmManagedUser = AuthDirectoryRow & {
  roleRowId: string | null;
  role: AppRole | null;
  teamDisplayName: string | null;
  implementerName: string | null;
  profileActive: boolean;
  displayName: string;
  missingProfile: boolean;
  riskFlags: string[];
};

export type UserDirectoryFilters = {
  search: string;
  role: "all" | "owner" | "administrator";
  mapping: "all" | "missing" | "ok";
};

type RoleRow = { id: string; user_id: string; role: string };
type ProfileRow = {
  user_id: string;
  display_name: string;
  implementer_name: string;
  active: boolean;
};

export function resolveUserDisplayName(input: {
  email: string;
  authDisplayName?: string | null;
  teamDisplayName?: string | null;
}): string {
  const team = input.teamDisplayName?.trim();
  if (team) return team;
  const auth = input.authDisplayName?.trim();
  if (auth) return auth;
  const local = input.email.split("@")[0]?.trim();
  return local || input.email;
}

export function buildRiskFlags(
  role: AppRole | null,
  profile: ProfileRow | undefined,
  standardImplementers: readonly string[],
): string[] {
  const flags: string[] = [];
  if (isAdministrator(role) && !profile?.active) {
    flags.push("Chýba team profile — provízie neuvidí");
  }
  if (isOwner(role) && !profile?.active) {
    flags.push("Owner bez team profile (OK pre plný prístup)");
  }
  if (
    isAdministrator(role) &&
    profile?.active &&
    profile.implementer_name &&
    !standardImplementers.includes(profile.implementer_name)
  ) {
    flags.push("Implementer mimo štandardného zoznamu");
  }
  return flags;
}

export function buildCrmManagedUsers(
  directory: AuthDirectoryRow[],
  roles: RoleRow[],
  profiles: ProfileRow[],
  standardImplementers: readonly string[],
): CrmManagedUser[] {
  const roleByUser = new Map(roles.map((r) => [r.user_id, r]));
  const profileByUser = new Map(profiles.map((p) => [p.user_id, p]));

  const directoryIds = new Set(directory.map((d) => d.userId));
  const extraRoleUsers = roles.filter((r) => !directoryIds.has(r.user_id));

  const rows: AuthDirectoryRow[] = [
    ...directory,
    ...extraRoleUsers.map((r) => ({
      userId: r.user_id,
      email: "",
      authDisplayName: null as string | null,
    })),
  ];

  return rows.map((d) => {
    const roleRow = roleByUser.get(d.userId);
    const prof = profileByUser.get(d.userId);
    const role = normalizeAppRole(roleRow?.role ?? null);
    const missingProfile = isAdministrator(role) && !prof?.active;
    const teamDisplayName = prof?.display_name?.trim() || null;

    return {
      userId: d.userId,
      email: d.email,
      authDisplayName: d.authDisplayName,
      createdAt: d.createdAt,
      roleRowId: roleRow?.id ?? null,
      role,
      teamDisplayName,
      implementerName: prof?.active ? prof.implementer_name : null,
      profileActive: !!prof?.active,
      displayName: resolveUserDisplayName({
        email: d.email || d.userId,
        authDisplayName: d.authDisplayName,
        teamDisplayName,
      }),
      missingProfile,
      riskFlags: buildRiskFlags(role, prof, standardImplementers),
    };
  });
}

export function userMatchesSearch(user: CrmManagedUser, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    user.displayName,
    user.email,
    user.authDisplayName,
    user.teamDisplayName,
    user.implementerName,
    user.role,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function countOwners(users: CrmManagedUser[]): number {
  return users.filter((u) => u.role === "owner").length;
}

export function isLastOwner(users: CrmManagedUser[], userId: string): boolean {
  const user = users.find((u) => u.userId === userId);
  if (!user || user.role !== "owner") return false;
  return countOwners(users) <= 1;
}

export function canRemoveOwnerRole(users: CrmManagedUser[], user: CrmManagedUser): boolean {
  if (user.role !== "owner") return true;
  return countOwners(users) > 1;
}

export function canDemoteOwner(users: CrmManagedUser[], userId: string): boolean {
  return !isLastOwner(users, userId);
}

export function implementerNameTaken(
  users: CrmManagedUser[],
  name: string,
  exceptUserId?: string,
): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const key = trimmed.toLowerCase();
  return users.some(
    (u) =>
      u.userId !== exceptUserId &&
      u.implementerName?.trim().toLowerCase() === key,
  );
}

export function filterManagedUsers(
  users: CrmManagedUser[],
  filters: UserDirectoryFilters,
): CrmManagedUser[] {
  return users.filter((u) => {
    if (filters.role === "owner" && u.role !== "owner") return false;
    if (filters.role === "administrator" && u.role !== "administrator") return false;
    if (filters.mapping === "missing" && !u.missingProfile) return false;
    if (filters.mapping === "ok" && u.missingProfile) return false;
    return userMatchesSearch(u, filters.search);
  });
}

export function duplicateDisplayNameKeys(users: CrmManagedUser[]): Set<string> {
  const counts = new Map<string, number>();
  for (const u of users) {
    const key = u.displayName.trim().toLowerCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([k]) => k));
}

export function sortUsersForAccessReview(a: CrmManagedUser, b: CrmManagedUser): number {
  const aCritical = a.missingProfile ? 1 : 0;
  const bCritical = b.missingProfile ? 1 : 0;
  if (aCritical !== bCritical) return bCritical - aCritical;

  const aRisk = a.riskFlags.filter((f) => f.includes("Chýba")).length;
  const bRisk = b.riskFlags.filter((f) => f.includes("Chýba")).length;
  if (aRisk !== bRisk) return bRisk - aRisk;

  const labelA = `${a.displayName} ${a.email}`.toLowerCase();
  const labelB = `${b.displayName} ${b.email}`.toLowerCase();
  return labelA.localeCompare(labelB, "sk");
}

export function sortUsersForManagement(a: CrmManagedUser, b: CrmManagedUser): number {
  if (a.missingProfile !== b.missingProfile) return a.missingProfile ? -1 : 1;
  return sortUsersForAccessReview(a, b);
}

export function userActionLabel(user: CrmManagedUser): string {
  const base = user.displayName;
  if (!user.email) return base;
  return `${base} (${user.email})`;
}

export const DEFAULT_USER_DIRECTORY_FILTERS: UserDirectoryFilters = {
  search: "",
  role: "all",
  mapping: "all",
};

/** Hash target for Settings → add-user section (owner pending auth review). */
export const PENDING_AUTH_USER_REVIEW_HASH = "pending-auth-users";

export function pendingAuthUserReviewMessage(count: number): string | null {
  if (count <= 0) return null;
  if (count === 1) return "Čaká 1 nový účet na priradenie CRM role";
  if (count >= 2 && count <= 4) return `Čaká ${count} nové účty na priradenie CRM role`;
  return `Čaká ${count} nových účtov na priradenie CRM role`;
}
