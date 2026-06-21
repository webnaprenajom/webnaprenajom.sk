/**
 * Settings implementer catalog — rename + account assignment (live registry / RBAC only).
 */
import { supabase } from "@/integrations/supabase/client";
import type { CrmManagedUser } from "@/lib/admin/crmUserDirectory";
import { implementerNameTaken } from "@/lib/admin/crmUserDirectory";
import type { AppRole } from "@/lib/rbac/permissions";
import {
  buildTeamProfileDeactivateUpdate,
  normalizeTeamDisplayName,
} from "@/lib/admin/teamProfileLifecycle";
import type { CrmImplementerRow, ImplementerRegistryEntry } from "@/lib/admin/implementerRegistry";
import {
  implementerNamesEqual,
  implementerRegistryNameTaken,
  normalizeImplementerName,
} from "@/lib/admin/implementerRegistry";

export type ImplementerCatalogEditDraft = {
  name: string;
  assignedUserId: string | null;
};

export type ImplementerCatalogEditValidation = {
  ok: boolean;
  error: string | null;
  warnings: string[];
};

export type ImplementerCatalogEditScope = {
  /** Owner in Settings — may assign to any CRM owner/administrator account. */
  actorIsOwner: boolean;
  actorUserId?: string | null;
};

const defaultOwnerScope: ImplementerCatalogEditScope = { actorIsOwner: true };

function userCanReceiveImplementer(
  user: CrmManagedUser,
  implementerName: string,
  currentAssignedUserId: string | null,
): boolean {
  if (user.userId === currentAssignedUserId) return true;
  if (!user.profileActive || !user.implementerName?.trim()) return true;
  return implementerNamesEqual(user.implementerName, implementerName);
}

function isImplementerAssignableRole(role: AppRole | null): boolean {
  return role === "owner" || role === "administrator";
}

export function listAssignableUsersForImplementer(
  managedUsers: CrmManagedUser[],
  implementerName: string,
  currentAssignedUserId: string | null,
  scope: ImplementerCatalogEditScope = defaultOwnerScope,
): CrmManagedUser[] {
  return managedUsers.filter((user) => {
    if (!scope.actorIsOwner) {
      if (user.userId !== scope.actorUserId) return false;
      if (user.role !== "administrator") return false;
    } else if (!isImplementerAssignableRole(user.role)) {
      return false;
    }
    return userCanReceiveImplementer(user, implementerName, currentAssignedUserId);
  });
}

export function validateImplementerCatalogEdit(input: {
  entry: Pick<
    ImplementerRegistryEntry,
    "name" | "inRegistry" | "active" | "assignedUserId"
  >;
  draft: ImplementerCatalogEditDraft;
  registry: CrmImplementerRow[];
  managedUsers: CrmManagedUser[];
  scope?: ImplementerCatalogEditScope;
}): ImplementerCatalogEditValidation {
  const scope = input.scope ?? defaultOwnerScope;
  const warnings: string[] = [];
  const normalized = normalizeImplementerName(input.draft.name);
  if (!normalized) {
    return {
      ok: false,
      error: "Meno musí mať aspoň 2 znaky a nesmie obsahovať rezervovaný suffix.",
      warnings,
    };
  }

  const nameChanged = !implementerNamesEqual(input.entry.name, normalized);
  const assignChanged = input.draft.assignedUserId !== input.entry.assignedUserId;

  if (!nameChanged && !assignChanged) {
    return { ok: false, error: "Žiadna zmena na uloženie.", warnings };
  }

  if (nameChanged) {
    if (
      implementerRegistryNameTaken(input.registry, normalized, input.entry.name)
    ) {
      return {
        ok: false,
        error: "Aktívny realizátor s týmto menom je už v registri.",
        warnings,
      };
    }
    warnings.push(
      "Historické provízie, prenájmy a finančné záznamy so starým menom zostávajú — mení sa len živý katalóg a RBAC profil.",
    );
  }

  if (input.draft.assignedUserId) {
    const user = input.managedUsers.find((u) => u.userId === input.draft.assignedUserId);
    if (!user) {
      return { ok: false, error: "Vybraný účet sa nenašiel.", warnings };
    }
    if (!scope.actorIsOwner) {
      if (user.userId !== scope.actorUserId) {
        return {
          ok: false,
          error: "Môžete meniť len vlastné priradenie realizátora.",
          warnings,
        };
      }
      if (user.role !== "administrator") {
        return {
          ok: false,
          error: "Realizátora možno priradiť len účtu s rolou administrator.",
          warnings,
        };
      }
    } else if (!isImplementerAssignableRole(user.role)) {
      return {
        ok: false,
        error: "Účet nemá CRM rolu owner ani administrator.",
        warnings,
      };
    }
    if (
      user.profileActive &&
      user.implementerName &&
      !implementerNamesEqual(user.implementerName, input.entry.name) &&
      user.userId !== input.entry.assignedUserId
    ) {
      return {
        ok: false,
        error: `Účet ${user.displayName} už používa realizátora ${user.implementerName}.`,
        warnings,
      };
    }
  }

  const exceptUserId = input.draft.assignedUserId ?? input.entry.assignedUserId ?? undefined;
  if (
    implementerNameTaken(input.managedUsers, normalized, exceptUserId) &&
    (assignChanged || nameChanged)
  ) {
    return {
      ok: false,
      error: "Toto meno realizátora už používa iný aktívny účet.",
      warnings,
    };
  }

  if (!input.entry.inRegistry && nameChanged && !input.entry.assignedUserId && !assignChanged) {
    return {
      ok: false,
      error: "Meno nie je v registri — priraďte účet alebo najprv pridajte realizátora.",
      warnings,
    };
  }

  return { ok: true, error: null, warnings };
}

async function ensureImplementerInRegistry(name: string, active: boolean) {
  const { error } = await supabase.from("crm_implementers").upsert({ name, active });
  if (error) throw error;
}

async function deactivateTeamProfile(userId: string, implementerName: string) {
  const payload = buildTeamProfileDeactivateUpdate(userId, implementerName);
  const { error } = await supabase.from("team_profiles").update(payload).eq("user_id", userId);
  if (error) throw error;
}

export async function applyImplementerCatalogEdit(input: {
  entry: Pick<
    ImplementerRegistryEntry,
    "name" | "inRegistry" | "active" | "assignedUserId"
  >;
  draft: ImplementerCatalogEditDraft;
  managedUsers: CrmManagedUser[];
  registry: CrmImplementerRow[];
  scope?: ImplementerCatalogEditScope;
}): Promise<{ finalName: string }> {
  const normalized = normalizeImplementerName(input.draft.name);
  if (!normalized) throw new Error("Neplatné meno");

  const validation = validateImplementerCatalogEdit({
    entry: input.entry,
    draft: input.draft,
    registry: input.registry,
    managedUsers: input.managedUsers,
    scope: input.scope,
  });
  if (!validation.ok) throw new Error(validation.error ?? "Úprava nie je povolená");

  const nameChanged = !implementerNamesEqual(input.entry.name, normalized);
  const assignChanged = input.draft.assignedUserId !== input.entry.assignedUserId;
  const finalName = normalized;

  if (nameChanged && input.entry.inRegistry) {
    const { error } = await supabase
      .from("crm_implementers")
      .update({ name: finalName })
      .eq("name", input.entry.name);
    if (error) throw error;
  } else if (nameChanged && !input.entry.inRegistry) {
    await ensureImplementerInRegistry(finalName, input.entry.active);
  }

  const previousUserId = input.entry.assignedUserId;
  const nextUserId = input.draft.assignedUserId;

  if (nameChanged && previousUserId && previousUserId === nextUserId) {
    const user = input.managedUsers.find((u) => u.userId === previousUserId);
    if (user?.profileActive) {
      const display_name = normalizeTeamDisplayName(
        user.teamDisplayName ?? user.displayName,
        finalName,
      );
      const { error } = await supabase
        .from("team_profiles")
        .update({ implementer_name: finalName, display_name })
        .eq("user_id", previousUserId);
      if (error) throw error;
    }
  }

  if (assignChanged) {
    if (previousUserId && previousUserId !== nextUserId) {
      const prev = input.managedUsers.find((u) => u.userId === previousUserId);
      if (prev?.implementerName && prev.profileActive) {
        await deactivateTeamProfile(previousUserId, prev.implementerName);
      }
    }

    if (nextUserId) {
      const user = input.managedUsers.find((u) => u.userId === nextUserId);
      if (!user) throw new Error("Vybraný účet sa nenašiel.");
      await ensureImplementerInRegistry(finalName, true);
      const display_name = normalizeTeamDisplayName(user.teamDisplayName ?? user.displayName, finalName);
      const { error } = await supabase.from("team_profiles").upsert({
        user_id: nextUserId,
        display_name,
        implementer_name: finalName,
        active: true,
      });
      if (error) throw error;
    }
  }

  if (nameChanged && !assignChanged && !previousUserId && input.entry.inRegistry) {
    await ensureImplementerInRegistry(finalName, input.entry.active);
  }

  return { finalName };
}
