import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { assigneeSelectOptions } from "@/lib/assignees";
import { Loader2, Plus, Trash2, AlertTriangle } from "lucide-react";
import type { AppRole } from "@/lib/rbac/permissions";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useCrmUserDirectory } from "@/hooks/useCrmUserDirectory";
import { ConfirmSensitiveActionDialog } from "@/components/admin/rbac/ConfirmSensitiveActionDialog";
import { AUDIT_ACTION_TYPES, logAdminAuditEvent } from "@/lib/audit/auditLog";
import { CrmUserIdentity } from "@/components/admin/settings/CrmUserIdentity";
import { CrmUserDirectoryFilters } from "@/components/admin/settings/CrmUserDirectoryFilters";
import {
  DEFAULT_USER_DIRECTORY_FILTERS,
  PENDING_AUTH_USER_REVIEW_HASH,
  pendingAuthUserReviewMessage,
  canDemoteOwner,
  canRemoveOwnerRole,
  duplicateDisplayNameKeys,
  filterManagedUsers,
  implementerNameTaken,
  sortUsersForManagement,
  userActionLabel,
  userMatchesSearch,
  type CrmManagedUser,
} from "@/lib/admin/crmUserDirectory";
import {
  buildTeamProfileDeactivateUpdate,
  normalizeTeamDisplayName,
} from "@/lib/admin/teamProfileLifecycle";

type PendingAction =
  | {
      kind: "add";
      userId: string;
      userLabel: string;
      role: AppRole;
      implementer: string;
      displayName: string;
    }
  | { kind: "remove"; roleRowId: string; userId: string; userLabel: string; role: AppRole }
  | {
      kind: "change_role";
      roleRowId: string;
      userId: string;
      userLabel: string;
      fromRole: AppRole;
      toRole: AppRole;
    }
  | {
      kind: "assign";
      userId: string;
      userLabel: string;
      implementer: string;
      displayName: string;
      previous: string | null;
    }
  | {
      kind: "edit_display";
      userId: string;
      userLabel: string;
      displayName: string;
      implementerName: string;
    };

const CRM_ROLES: AppRole[] = ["owner", "administrator"];

export function UserManagementPanel() {
  const { userId: actorId } = useAdminAccess();
  const { loading, error, withRole, withoutRole, reload } = useCrmUserDirectory();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [filters, setFilters] = useState(DEFAULT_USER_DIRECTORY_FILTERS);
  const [newRole, setNewRole] = useState<AppRole>("administrator");
  const [newImplementer, setNewImplementer] = useState<string>(() => assigneeSelectOptions()[0] ?? "");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [selectedAddUserId, setSelectedAddUserId] = useState<string | null>(null);
  const [addSearch, setAddSearch] = useState("");
  const [displayNameDrafts, setDisplayNameDrafts] = useState<Record<string, string>>({});

  const filteredManaged = useMemo(() => {
    return filterManagedUsers(withRole, filters).sort(sortUsersForManagement);
  }, [withRole, filters]);

  const duplicateNames = useMemo(() => duplicateDisplayNameKeys(withRole), [withRole]);

  const addCandidates = useMemo(() => {
    const q = addSearch.trim();
    return withoutRole
      .filter((u) => userMatchesSearch(u, q))
      .sort((a, b) => `${a.displayName} ${a.email}`.localeCompare(`${b.displayName} ${b.email}`, "sk"));
  }, [withoutRole, addSearch]);

  const selectedAddUser = withoutRole.find((u) => u.userId === selectedAddUserId) ?? null;
  const pendingReviewMessage = pendingAuthUserReviewMessage(withoutRole.length);

  useEffect(() => {
    if (loading || withoutRole.length === 0) return;
    if (window.location.hash.replace(/^#/, "") !== PENDING_AUTH_USER_REVIEW_HASH) return;
    document.getElementById(PENDING_AUTH_USER_REVIEW_HASH)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [loading, withoutRole.length]);
  const usersMissingProfile = withRole.filter((u) => u.missingProfile);
  const orphanProfiles = withoutRole.filter((u) => u.orphanActiveProfile);
  const implementerOptions = assigneeSelectOptions();

  const deactivateTeamProfile = async (userId: string, implementerName: string | null) => {
    if (!implementerName?.trim()) return;
    const payload = buildTeamProfileDeactivateUpdate(userId, implementerName);
    const { error } = await supabase.from("team_profiles").update(payload).eq("user_id", userId);
    if (error) {
      toast({ title: "Team profile", description: error.message, variant: "destructive" });
      return false;
    }
    return true;
  };

  const executeAddUser = async (action: Extract<PendingAction, { kind: "add" }>) => {
    const { error: roleErr } = await supabase
      .from("user_roles")
      .insert({ user_id: action.userId, role: action.role });
    if (roleErr) {
      toast({ title: "Rola", description: roleErr.message, variant: "destructive" });
      return;
    }
    if (action.role === "administrator" && action.implementer) {
      const { error: profileErr } = await supabase.from("team_profiles").upsert({
        user_id: action.userId,
        display_name: action.displayName.trim() || action.implementer,
        implementer_name: action.implementer,
        active: true,
      });
      if (profileErr) {
        toast({ title: "Team profile", description: profileErr.message, variant: "destructive" });
        void reload();
        return;
      }
    }
    if (actorId) {
      void logAdminAuditEvent({
        actorUserId: actorId,
        actionType: AUDIT_ACTION_TYPES.role_assigned,
        targetType: "user",
        targetId: action.userId,
        summary: `Rola ${action.role} pre ${action.userLabel}`,
        after: { role: action.role, implementer: action.implementer || null },
      });
    }
    toast({ title: "Používateľ pridaný" });
    setSelectedAddUserId(null);
    setAddSearch("");
    setNewDisplayName("");
    void reload();
  };

  const addUser = () => {
    if (!selectedAddUser) {
      toast({ title: "Vyberte používateľa zo zoznamu", variant: "destructive" });
      return;
    }
    if (
      newRole === "administrator" &&
      implementerNameTaken(withRole, newImplementer, selectedAddUser.userId)
    ) {
      toast({
        title: "Implementer obsadený",
        description: "Toto meno realizátora už používa iný účet.",
        variant: "destructive",
      });
      return;
    }
    setPending({
      kind: "add",
      userId: selectedAddUser.userId,
      userLabel: userActionLabel(selectedAddUser),
      role: newRole,
      implementer: newImplementer,
      displayName: newDisplayName,
    });
  };

  const executeRemoveRole = async (action: Extract<PendingAction, { kind: "remove" }>) => {
    const user = withRole.find((u) => u.userId === action.userId);
    const { error } = await supabase.from("user_roles").delete().eq("id", action.roleRowId);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    if (user?.implementerName) {
      const ok = await deactivateTeamProfile(action.userId, user.implementerName);
      if (!ok) {
        void reload();
        return;
      }
    }
    if (actorId) {
      void logAdminAuditEvent({
        actorUserId: actorId,
        actionType: AUDIT_ACTION_TYPES.role_removed,
        targetType: "user",
        targetId: action.userId,
        summary: `Odstránená rola ${action.role} pre ${action.userLabel}`,
        before: { role: action.role, implementer: user?.implementerName ?? null },
        after: { team_profile: user?.implementerName ? "deactivated" : null },
      });
    }
    toast({ title: "Rola odstránená" });
    void reload();
  };

  const removeRole = (user: CrmManagedUser) => {
    if (!user.roleRowId || !user.role) return;
    if (!canRemoveOwnerRole(withRole, user)) {
      toast({
        title: "Posledný owner",
        description: "Nemôžete odstrániť posledného ownera v systéme.",
        variant: "destructive",
      });
      return;
    }
    setPending({
      kind: "remove",
      roleRowId: user.roleRowId,
      userId: user.userId,
      userLabel: userActionLabel(user),
      role: user.role,
    });
  };

  const executeChangeRole = async (action: Extract<PendingAction, { kind: "change_role" }>) => {
    const user = withRole.find((u) => u.userId === action.userId);
    const { error } = await supabase
      .from("user_roles")
      .update({ role: action.toRole })
      .eq("id", action.roleRowId);
    if (error) {
      toast({ title: "Zmena roly", description: error.message, variant: "destructive" });
      return;
    }
    if (action.fromRole === "administrator" && action.toRole === "owner" && user?.implementerName) {
      const ok = await deactivateTeamProfile(action.userId, user.implementerName);
      if (!ok) {
        void reload();
        return;
      }
    }
    if (actorId) {
      void logAdminAuditEvent({
        actorUserId: actorId,
        actionType: AUDIT_ACTION_TYPES.role_assigned,
        targetType: "user",
        targetId: action.userId,
        summary: `${action.userLabel}: ${action.fromRole} → ${action.toRole}`,
        before: { role: action.fromRole, implementer: user?.implementerName ?? null },
        after: {
          role: action.toRole,
          team_profile:
            action.fromRole === "administrator" && action.toRole === "owner" && user?.implementerName
              ? "deactivated"
              : undefined,
        },
      });
    }
    toast({
      title: "Rola zmenená",
      description:
        action.toRole === "administrator" && !user?.profileActive
          ? "Priraďte implementera — bez team profile neuvidí provízie."
          : undefined,
    });
    void reload();
  };

  const changeRole = (user: CrmManagedUser, toRole: AppRole) => {
    if (!user.roleRowId || !user.role || user.role === toRole) return;
    if (user.role === "owner" && toRole === "administrator" && !canDemoteOwner(withRole, user.userId)) {
      toast({
        title: "Posledný owner",
        description: "Nemôžete zmeniť rolu posledného ownera na administrator.",
        variant: "destructive",
      });
      return;
    }
    setPending({
      kind: "change_role",
      roleRowId: user.roleRowId,
      userId: user.userId,
      userLabel: userActionLabel(user),
      fromRole: user.role,
      toRole,
    });
  };

  const executeAssignProfile = async (action: Extract<PendingAction, { kind: "assign" }>) => {
    const { error } = await supabase.from("team_profiles").upsert({
      user_id: action.userId,
      display_name: action.displayName.trim() || action.implementer,
      implementer_name: action.implementer,
      active: true,
    });
    if (error) {
      toast({ title: "Profil", description: error.message, variant: "destructive" });
      return;
    }
    if (actorId) {
      void logAdminAuditEvent({
        actorUserId: actorId,
        actionType: action.previous
          ? AUDIT_ACTION_TYPES.team_profile_updated
          : AUDIT_ACTION_TYPES.team_profile_assigned,
        targetType: "user",
        targetId: action.userId,
        summary: `${action.userLabel}: team profile → ${action.implementer}`,
        before: action.previous ? { implementer_name: action.previous } : null,
        after: { implementer_name: action.implementer },
      });
    }
    toast({ title: "Team profile uložený" });
    void reload();
  };

  const assignProfile = (user: CrmManagedUser, implementerName: string) => {
    if (implementerNameTaken(withRole, implementerName, user.userId)) {
      toast({
        title: "Implementer obsadený",
        description: "Toto meno realizátora už používa iný účet.",
        variant: "destructive",
      });
      return;
    }
    setPending({
      kind: "assign",
      userId: user.userId,
      userLabel: userActionLabel(user),
      implementer: implementerName,
      displayName: user.teamDisplayName ?? user.displayName,
      previous: user.implementerName,
    });
  };

  const executeEditDisplayName = async (action: Extract<PendingAction, { kind: "edit_display" }>) => {
    const display_name = normalizeTeamDisplayName(action.displayName, action.implementerName);
    const { error } = await supabase
      .from("team_profiles")
      .update({ display_name })
      .eq("user_id", action.userId);
    if (error) {
      toast({ title: "Zobrazované meno", description: error.message, variant: "destructive" });
      return;
    }
    if (actorId) {
      void logAdminAuditEvent({
        actorUserId: actorId,
        actionType: AUDIT_ACTION_TYPES.team_profile_updated,
        targetType: "user",
        targetId: action.userId,
        summary: `${action.userLabel}: display name → ${display_name}`,
        after: { display_name },
      });
    }
    toast({ title: "Zobrazované meno uložené" });
    void reload();
  };

  const editDisplayName = (user: CrmManagedUser, displayName: string) => {
    if (!user.implementerName) return;
    setPending({
      kind: "edit_display",
      userId: user.userId,
      userLabel: userActionLabel(user),
      displayName,
      implementerName: user.implementerName,
    });
  };

  const cleanupOrphanProfile = async (user: CrmManagedUser) => {
    if (!user.implementerName) return;
    const ok = await deactivateTeamProfile(user.userId, user.implementerName);
    if (!ok) return;
    toast({ title: "Orphan profil deaktivovaný" });
    void reload();
  };

  const confirmPending = async () => {
    if (!pending) return;
    const p = pending;
    setPending(null);
    if (p.kind === "add") await executeAddUser(p);
    if (p.kind === "remove") await executeRemoveRole(p);
    if (p.kind === "change_role") await executeChangeRole(p);
    if (p.kind === "assign") await executeAssignProfile(p);
    if (p.kind === "edit_display") await executeEditDisplayName(p);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-xs text-destructive">
        Adresár používateľov sa nepodarilo načítať: {error}. Skontrolujte migráciu{" "}
        <code className="text-[10px]">admin_list_auth_users</code>.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Owner vidí celé CRM a financie. Administrator vidí len vlastné provízie — musí mať team profile
        s menom realizátora (rovnaké ako v províziách). Spravujte účty podľa mena a e-mailu; interné ID
        zostáva len v technických detailoch.
      </p>

      {pendingReviewMessage && (
        <div
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs flex gap-2"
          role="status"
        >
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <p>{pendingReviewMessage}</p>
        </div>
      )}

      {usersMissingProfile.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs flex gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <p>
            <strong>{usersMissingProfile.length}</strong> používateľ(ov) s rolou administrator nemá team
            profile — neuvidia provízie, kým im nepriradíte implementera.
          </p>
        </div>
      )}

      {orphanProfiles.length > 0 && (
        <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 p-3 text-xs flex gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0" />
          <p>
            <strong>{orphanProfiles.length}</strong> auth účet(ov) má aktívny team profile bez CRM role
            (historický stav). Pri opätovnom onboardingu môže blokovať meno realizátora — deaktivujte v
            zozname nižšie.
          </p>
        </div>
      )}

      <CrmUserDirectoryFilters filters={filters} onChange={setFilters} />

      <ul className="divide-y rounded-xl border text-sm">
        {filteredManaged.length === 0 && (
          <li className="p-4 text-muted-foreground italic text-center">
            {withRole.length === 0
              ? "Žiadni používatelia s rolou."
              : "Žiadni používatelia nezodpovedajú filtru. Skúste iné meno alebo e-mail."}
          </li>
        )}
        {filteredManaged.map((user) => (
          <li key={user.roleRowId ?? user.userId} className="p-3 flex flex-wrap items-start gap-2 justify-between">
            <CrmUserIdentity user={user} duplicateNames={duplicateNames} />
            <div className="flex flex-col items-end gap-2 shrink-0 min-w-[10rem]">
              <div className="flex gap-2 flex-wrap items-center justify-end">
                <Badge variant="outline">{user.role}</Badge>
                {user.implementerName && (
                  <Badge variant="secondary" className="text-[10px]">
                    {user.implementerName}
                  </Badge>
                )}
                {user.missingProfile && (
                  <Badge variant="destructive" className="text-[10px]">
                    Chýba team profile
                  </Badge>
                )}
                {user.profileActive && user.role === "administrator" && (
                  <Badge variant="outline" className="text-[10px] text-green-600 border-green-500/40">
                    Aktívny realizátor
                  </Badge>
                )}
                {user.inactiveProfile && (
                  <Badge variant="secondary" className="text-[10px]">
                    Neaktívny profil
                  </Badge>
                )}
              </div>
              {user.role === "administrator" && user.profileActive && user.implementerName && (
                <div className="flex flex-wrap gap-2 items-end justify-end w-full">
                  <div className="space-y-1 min-w-[10rem]">
                    <Label className="text-[10px] text-muted-foreground">Zobrazované meno</Label>
                    <div className="flex gap-1">
                      <Input
                        className="h-8 text-xs"
                        value={
                          displayNameDrafts[user.userId] ??
                          user.teamDisplayName ??
                          user.implementerName
                        }
                        onChange={(e) =>
                          setDisplayNameDrafts((prev) => ({
                            ...prev,
                            [user.userId]: e.target.value,
                          }))
                        }
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs shrink-0"
                        onClick={() =>
                          editDisplayName(
                            user,
                            displayNameDrafts[user.userId] ??
                              user.teamDisplayName ??
                              user.implementerName ??
                              "",
                          )
                        }
                      >
                        Uložiť
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2 items-end justify-end">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Rola</Label>
                  <Select
                    value={user.role ?? undefined}
                    onValueChange={(v) => changeRole(user, v as AppRole)}
                  >
                    <SelectTrigger className="h-8 w-[9.5rem] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CRM_ROLES.map((r) => (
                        <SelectItem key={r} value={r} className="text-xs">
                          {r === "owner" ? "Owner" : "Administrator"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {user.role === "administrator" && (
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Implementer</Label>
                    <Select
                      value={user.implementerName || undefined}
                      onValueChange={(v) => assignProfile(user, v)}
                    >
                      <SelectTrigger className="h-8 w-[9.5rem] text-xs">
                        <SelectValue placeholder="Vyberte…" />
                      </SelectTrigger>
                      <SelectContent>
                        {assigneeSelectOptions(user.implementerName).map((name) => (
                          <SelectItem key={name} value={name} className="text-xs">
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="text-destructive"
                onClick={() => removeRole(user)}
                disabled={!canRemoveOwnerRole(withRole, user)}
                aria-label={`Odstrániť rolu ${user.displayName}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div
        id={PENDING_AUTH_USER_REVIEW_HASH}
        className="rounded-xl border p-4 space-y-3 bg-muted/20 scroll-mt-4"
      >
        <h3 className="text-sm font-semibold">Pridať používateľa do CRM</h3>
        <p className="text-xs text-muted-foreground">
          Vyberte existujúci auth účet (podľa mena alebo e-mailu). Nový účet musí byť najprv vytvorený
          prihlásením alebo pozvánkou — tu len priraďujete CRM rolu.
        </p>
        <div className="space-y-1.5">
          <Label className="text-xs">Hľadať účet bez CRM role</Label>
          <Input
            value={addSearch}
            onChange={(e) => setAddSearch(e.target.value)}
            placeholder="Meno alebo e-mail…"
          />
        </div>
        <ul className="max-h-40 overflow-y-auto divide-y rounded-lg border text-xs">
          {addCandidates.length === 0 && (
            <li className="p-3 text-muted-foreground italic text-center">
              {withoutRole.length === 0
                ? "Všetky auth účty už majú priradenú CRM rolu."
                : "Žiadny účet nezodpovedá hľadaniu."}
            </li>
          )}
          {addCandidates.map((user) => {
            const selected = selectedAddUserId === user.userId;
            return (
              <li key={user.userId}>
                <button
                  type="button"
                  className={`w-full text-left p-2.5 hover:bg-muted/50 transition-colors ${
                    selected ? "bg-primary/10 ring-1 ring-primary/30" : ""
                  }`}
                  onClick={() => {
                    setSelectedAddUserId(user.userId);
                    if (!newDisplayName) {
                      setNewDisplayName(user.displayName);
                    }
                  }}
                >
                  <CrmUserIdentity user={user} compact />
                  {user.orphanActiveProfile && (
                    <div className="px-2.5 pb-2 flex flex-wrap gap-2 items-center">
                      <Badge variant="destructive" className="text-[10px]">
                        Orphan profil
                      </Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px]"
                        onClick={(e) => {
                          e.stopPropagation();
                          void cleanupOrphanProfile(user);
                        }}
                      >
                        Deaktivovať profil
                      </Button>
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        {selectedAddUser && (
          <p className="text-xs text-muted-foreground">
            Vybrané: <strong>{userActionLabel(selectedAddUser)}</strong>
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Rola</Label>
            <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="administrator">Administrator</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {newRole === "administrator" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Implementer (provízie)</Label>
              <Select value={newImplementer} onValueChange={setNewImplementer}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {implementerOptions.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        {newRole === "administrator" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Zobrazované meno v CRM</Label>
            <Input
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              placeholder={newImplementer}
            />
          </div>
        )}
        <Button size="sm" onClick={addUser} disabled={!selectedAddUser}>
          <Plus className="w-4 h-4 mr-1" /> Pridať do CRM
        </Button>
      </div>

      <ConfirmSensitiveActionDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={
          pending?.kind === "remove"
            ? "Odstrániť rolu používateľa?"
            : pending?.kind === "assign"
              ? "Uložiť team profile?"
              : pending?.kind === "edit_display"
                ? "Uložiť zobrazované meno?"
              : pending?.kind === "change_role"
                ? "Zmeniť rolu používateľa?"
                : "Pridať používateľa s rolou?"
        }
        description={
          pending?.kind === "add" ? (
            <>
              <p>
                <strong>{pending.userLabel}</strong> dostane rolu <strong>{pending.role}</strong>.
              </p>
              {pending.role === "administrator" && (
                <p>
                  Uvidí len provízie pre realizátora <strong>{pending.implementer}</strong>.
                </p>
              )}
              {pending.role === "owner" && (
                <p>Owner má plný prístup k CRM, nastaveniam a všetkým províziám.</p>
              )}
            </>
          ) :           pending?.kind === "remove" ? (
            <>
              <p>
                Odstránite rolu {pending.role} pre <strong>{pending.userLabel}</strong>.
              </p>
              <p>Používateľ stratí prístup k CRM, ak nemá inú rolu.</p>
              {withRole.find((u) => u.userId === pending.userId)?.implementerName && (
                <p>
                  Aktívny team profile realizátora bude deaktivovaný — meno bude možné znovu priradiť.
                </p>
              )}
            </>
          ) : pending?.kind === "change_role" ? (
            <>
              <p>
                <strong>{pending.userLabel}</strong>: {pending.fromRole} → <strong>{pending.toRole}</strong>
              </p>
              {pending.toRole === "administrator" && (
                <p>
                  Po zmene musí mať team profile s menom realizátora, inak neuvidí provízie.
                </p>
              )}
              {pending.fromRole === "administrator" && pending.toRole === "owner" && (
                <p>Aktívny team profile realizátora bude deaktivovaný (owner nepotrebuje scoped provízie).</p>
              )}
              {pending.toRole === "owner" && (
                <p>Owner má plný prístup k CRM a financiám.</p>
              )}
            </>
          ) : pending?.kind === "assign" ? (
            <>
              <p>
                <strong>{pending.userLabel}</strong> bude mapovaný na implementera{" "}
                <strong>{pending.implementer}</strong> — určuje, ktoré provízie uvidí v Financiách.
              </p>
              {pending.previous && <p>Predtým: {pending.previous}</p>}
            </>
          ) : pending?.kind === "edit_display" ? (
            <>
              <p>
                Uložiť zobrazované meno pre <strong>{pending.userLabel}</strong>?
              </p>
              <p>
                Nové meno: <strong>{normalizeTeamDisplayName(pending.displayName, pending.implementerName)}</strong>
              </p>
              <p className="text-muted-foreground">
                Meno realizátora v províziách ({pending.implementerName}) sa nemení.
              </p>
            </>
          ) : null
        }
        confirmLabel={
          pending?.kind === "remove"
            ? "Odstrániť rolu"
            : pending?.kind === "assign"
              ? "Uložiť profil"
              : pending?.kind === "edit_display"
                ? "Uložiť meno"
                : "Potvrdiť"
        }
        destructive={pending?.kind === "remove"}
        onConfirm={confirmPending}
      />
    </div>
  );
}
