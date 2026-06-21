/**
 * Implementer name registry — catalog for Settings; commission strings stay historical truth.
 */
import { CRM_ASSIGNEES } from "@/lib/assignees";
import type { CrmManagedUser } from "@/lib/admin/crmUserDirectory";

export type CrmImplementerRow = {
  name: string;
  active: boolean;
  created_at?: string;
};

export type ImplementerRegistryEntry = {
  name: string;
  active: boolean;
  /** Row exists in crm_implementers (vs. catalog-only name from team profile). */
  inRegistry: boolean;
  assignedUserId: string | null;
  assignedDisplayName: string | null;
  canRemove: boolean;
  removeBlockReason: string | null;
};

function implementerNamesEqual(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Safe catalog delete — historical commission/rental strings are untouched. */
export function evaluateImplementerRegistryRemove(
  entry: Pick<
    ImplementerRegistryEntry,
    "name" | "active" | "inRegistry" | "assignedUserId"
  >,
  managedUsers: CrmManagedUser[],
): { canRemove: boolean; removeBlockReason: string | null } {
  if (!entry.inRegistry) {
    return {
      canRemove: false,
      removeBlockReason: "Meno nie je v registri — zobrazuje sa len cez profil tímu.",
    };
  }
  if (entry.assignedUserId) {
    return {
      canRemove: false,
      removeBlockReason:
        "Realizátor je priradený k aktívnemu účtu. Najprv ho uvoľnite v správe používateľov.",
    };
  }
  const profileHolder = managedUsers.find(
    (user) =>
      user.implementerName &&
      !isArchivedImplementerName(user.implementerName) &&
      implementerNamesEqual(user.implementerName, entry.name),
  );
  if (profileHolder) {
    return {
      canRemove: false,
      removeBlockReason: `Meno je stále viazané na profil používateľa (${profileHolder.displayName}).`,
    };
  }
  if (entry.active) {
    return {
      canRemove: false,
      removeBlockReason: "Najprv deaktivujte realizátora v registri.",
    };
  }
  return { canRemove: true, removeBlockReason: null };
}

export function normalizeImplementerName(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length < 2) return null;
  if (trimmed.includes("__off__")) return null;
  return trimmed;
}

export function isArchivedImplementerName(name: string): boolean {
  return name.includes("__off__");
}

export function mergeImplementerCatalog(
  registry: CrmImplementerRow[],
  managedUsers: CrmManagedUser[],
  current?: string | null,
): string[] {
  const set = new Set<string>();
  if (registry.length > 0) {
    for (const row of registry) {
      if (!isArchivedImplementerName(row.name)) set.add(row.name.trim());
    }
  } else {
    for (const seed of CRM_ASSIGNEES) set.add(seed);
  }
  for (const user of managedUsers) {
    if (user.implementerName?.trim() && !isArchivedImplementerName(user.implementerName)) {
      set.add(user.implementerName.trim());
    }
  }
  const cur = current?.trim();
  if (cur) set.add(cur);
  return [...set].sort((a, b) => a.localeCompare(b, "sk"));
}

export function implementerRegistryNameTaken(
  registry: CrmImplementerRow[],
  name: string,
  exceptName?: string,
): boolean {
  const key = name.trim().toLowerCase();
  const except = exceptName?.trim().toLowerCase();
  return registry.some(
    (r) => r.active && r.name.trim().toLowerCase() === key && r.name.trim().toLowerCase() !== except,
  );
}

export function buildImplementerRegistryEntries(
  registry: CrmImplementerRow[],
  managedUsers: CrmManagedUser[],
): ImplementerRegistryEntry[] {
  const assignmentByName = new Map<string, { userId: string; displayName: string }>();
  for (const user of managedUsers) {
    if (user.implementerName && user.profileActive) {
      assignmentByName.set(user.implementerName, {
        userId: user.userId,
        displayName: user.displayName,
      });
    }
  }

  const names = mergeImplementerCatalog(registry, managedUsers);
  return names.map((name) => {
    const row = registry.find((r) => implementerNamesEqual(r.name, name));
    const assigned = assignmentByName.get(name) ?? null;
    const inRegistry = row != null;
    const base = {
      name,
      active: row?.active ?? true,
      inRegistry,
      assignedUserId: assigned?.userId ?? null,
      assignedDisplayName: assigned?.displayName ?? null,
    };
    const remove = evaluateImplementerRegistryRemove(base, managedUsers);
    return { ...base, ...remove };
  });
}
