import { useMemo, useState } from "react";
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
import { CRM_ASSIGNEES } from "@/lib/assignees";
import { Loader2, Plus, Trash2, AlertTriangle, UserPlus } from "lucide-react";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useCrmUserDirectory } from "@/hooks/useCrmUserDirectory";
import { ConfirmSensitiveActionDialog } from "@/components/admin/rbac/ConfirmSensitiveActionDialog";
import { AUDIT_ACTION_TYPES, logAdminAuditEvent } from "@/lib/audit/auditLog";
import { CrmUserIdentity } from "@/components/admin/settings/CrmUserIdentity";
import { CrmUserDirectoryFilters } from "@/components/admin/settings/CrmUserDirectoryFilters";
import {
  DEFAULT_USER_DIRECTORY_FILTERS,
  duplicateDisplayNameKeys,
  filterManagedUsers,
  sortUsersForManagement,
  userActionLabel,
  userMatchesSearch,
  type CrmManagedUser,
} from "@/lib/admin/crmUserDirectory";

type PendingAction =
  | {
      kind: "add";
      userId: string;
      userLabel: string;
      email: string;
      role: "admin" | "user";
      implementer: string;
      displayName: string;
    }
  | { kind: "remove"; roleRowId: string; userId: string; userLabel: string; role: string }
  | {
      kind: "assign";
      userId: string;
      userLabel: string;
      implementer: string;
      previous: string | null;
    };

export function UserManagementPanel() {
  const { userId: actorId } = useAdminAccess();
  const { loading, error, withRole, withoutRole, reload } = useCrmUserDirectory();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [filters, setFilters] = useState(DEFAULT_USER_DIRECTORY_FILTERS);
  const [newRole, setNewRole] = useState<"admin" | "user">("user");
  const [newImplementer, setNewImplementer] = useState<string>(CRM_ASSIGNEES[0]);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [selectedAddUserId, setSelectedAddUserId] = useState<string | null>(null);
  const [addSearch, setAddSearch] = useState("");

  const filteredManaged = useMemo(() => {
    const list = filterManagedUsers(withRole, filters).sort(sortUsersForManagement);
    return list;
  }, [withRole, filters]);

  const duplicateNames = useMemo(() => duplicateDisplayNameKeys(withRole), [withRole]);

  const addCandidates = useMemo(() => {
    const q = addSearch.trim();
    return withoutRole
      .filter((u) => userMatchesSearch(u, q))
      .sort((a, b) => `${a.displayName} ${a.email}`.localeCompare(`${b.displayName} ${b.email}`, "sk"));
  }, [withoutRole, addSearch]);

  const selectedAddUser = withoutRole.find((u) => u.userId === selectedAddUserId) ?? null;

  const usersMissingProfile = withRole.filter((u) => u.missingProfile);

  const executeAddUser = async (action: Extract<PendingAction, { kind: "add" }>) => {
    const { error: roleErr } = await supabase
      .from("user_roles")
      .insert({ user_id: action.userId, role: action.role });
    if (roleErr) {
      toast({ title: "Rola", description: roleErr.message, variant: "destructive" });
      return;
    }
    if (action.role === "user" && action.implementer) {
      await supabase.from("team_profiles").upsert({
        user_id: action.userId,
        display_name: action.displayName.trim() || action.implementer,
        implementer_name: action.implementer,
        active: true,
      });
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
    setPending({
      kind: "add",
      userId: selectedAddUser.userId,
      userLabel: userActionLabel(selectedAddUser),
      email: selectedAddUser.email,
      role: newRole,
      implementer: newImplementer,
      displayName: newDisplayName,
    });
  };

  const executeRemoveRole = async (action: Extract<PendingAction, { kind: "remove" }>) => {
    const { error } = await supabase.from("user_roles").delete().eq("id", action.roleRowId);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    if (actorId) {
      void logAdminAuditEvent({
        actorUserId: actorId,
        actionType: AUDIT_ACTION_TYPES.role_removed,
        targetType: "user",
        targetId: action.userId,
        summary: `Odstránená rola ${action.role} pre ${action.userLabel}`,
        before: { role: action.role },
      });
    }
    toast({ title: "Rola odstránená" });
    void reload();
  };

  const removeRole = (user: CrmManagedUser) => {
    if (!user.roleRowId) return;
    setPending({
      kind: "remove",
      roleRowId: user.roleRowId,
      userId: user.userId,
      userLabel: userActionLabel(user),
      role: user.role!,
    });
  };

  const executeAssignProfile = async (action: Extract<PendingAction, { kind: "assign" }>) => {
    const { error } = await supabase.from("team_profiles").upsert({
      user_id: action.userId,
      display_name: action.implementer,
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
    toast({ title: "Team profile priradený" });
    void reload();
  };

  const assignProfile = (user: CrmManagedUser, implementerName: string) => {
    setPending({
      kind: "assign",
      userId: user.userId,
      userLabel: userActionLabel(user),
      implementer: implementerName,
      previous: user.implementerName,
    });
  };

  const confirmPending = async () => {
    if (!pending) return;
    const p = pending;
    setPending(null);
    if (p.kind === "add") await executeAddUser(p);
    if (p.kind === "remove") await executeRemoveRole(p);
    if (p.kind === "assign") await executeAssignProfile(p);
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
        Admin vidí celé CRM a financie. User vidí len vlastné provízie — musí mať team profile s menom
        realizátora (rovnaké ako v províziách). Spravujte účty podľa mena a e-mailu; interné ID zostáva
        len v technických detailoch.
      </p>

      {usersMissingProfile.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs flex gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <p>
            <strong>{usersMissingProfile.length}</strong> používateľ(ov) s rolou user nemá team profile —
            neuvidia provízie, kým im nepriradíte implementera.
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
            <div className="flex flex-col items-end gap-2 shrink-0">
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
              </div>
              {user.missingProfile && (
                <div className="flex flex-wrap gap-1 justify-end">
                  {CRM_ASSIGNEES.map((name) => (
                    <Button
                      key={name}
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px]"
                      onClick={() => assignProfile(user, name)}
                    >
                      <UserPlus className="w-3 h-3 mr-0.5" /> {name}
                    </Button>
                  ))}
                </div>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="text-destructive"
                onClick={() => removeRole(user)}
                aria-label={`Odstrániť rolu ${user.displayName}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div className="rounded-xl border p-4 space-y-3 bg-muted/20">
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
            <Select value={newRole} onValueChange={(v) => setNewRole(v as "admin" | "user")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {newRole === "user" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Implementer (provízie)</Label>
              <Select value={newImplementer} onValueChange={setNewImplementer}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CRM_ASSIGNEES.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        {newRole === "user" && (
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
              ? "Priradiť team profile?"
              : "Pridať používateľa s rolou?"
        }
        description={
          pending?.kind === "add" ? (
            <>
              <p>
                <strong>{pending.userLabel}</strong> dostane rolu <strong>{pending.role}</strong>.
              </p>
              {pending.role === "user" && (
                <p>
                  Uvidí len provízie pre realizátora <strong>{pending.implementer}</strong>. Bez team
                  profile neuvidí financie.
                </p>
              )}
              {pending.role === "admin" && (
                <p>Admin má plný prístup k CRM, nastaveniam a všetkým províziám.</p>
              )}
            </>
          ) : pending?.kind === "remove" ? (
            <>
              <p>
                Odstránite rolu {pending.role} pre <strong>{pending.userLabel}</strong>.
              </p>
              <p>Používateľ stratí prístup k CRM, ak nemá inú rolu.</p>
            </>
          ) : pending?.kind === "assign" ? (
            <>
              <p>
                <strong>{pending.userLabel}</strong> bude mapovaný na implementera{" "}
                <strong>{pending.implementer}</strong> — určuje, ktoré provízie uvidí v Financiách.
              </p>
              {pending.previous && <p>Predtým: {pending.previous}</p>}
            </>
          ) : null
        }
        confirmLabel={pending?.kind === "remove" ? "Odstrániť rolu" : "Potvrdiť"}
        destructive={pending?.kind === "remove"}
        onConfirm={confirmPending}
      />
    </div>
  );
}
