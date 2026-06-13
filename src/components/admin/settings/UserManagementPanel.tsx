import { useCallback, useEffect, useState } from "react";
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
import { ConfirmSensitiveActionDialog } from "@/components/admin/rbac/ConfirmSensitiveActionDialog";
import { AUDIT_ACTION_TYPES, logAdminAuditEvent } from "@/lib/audit/auditLog";

type PendingAction =
  | { kind: "add"; userId: string; role: "admin" | "user"; implementer: string; displayName: string }
  | { kind: "remove"; roleRowId: string; userId: string; role: string }
  | { kind: "assign"; userId: string; implementer: string; previous: string | null };

type RoleRow = {
  id: string;
  user_id: string;
  role: "admin" | "user";
};

type ProfileRow = {
  user_id: string;
  display_name: string;
  implementer_name: string;
  active: boolean;
};

export function UserManagementPanel() {
  const { userId: actorId } = useAdminAccess();
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [newUserId, setNewUserId] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "user">("user");
  const [newImplementer, setNewImplementer] = useState<string>(CRM_ASSIGNEES[0]);
  const [newDisplayName, setNewDisplayName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [rolesRes, profilesRes] = await Promise.all([
      supabase.from("user_roles").select("id,user_id,role").order("created_at"),
      supabase.from("team_profiles").select("user_id,display_name,implementer_name,active"),
    ]);
    if (rolesRes.error) {
      toast({ title: "Chyba", description: rolesRes.error.message, variant: "destructive" });
    } else {
      setRoles((rolesRes.data || []) as RoleRow[]);
    }
    if (!profilesRes.error) {
      setProfiles((profilesRes.data || []) as ProfileRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
        summary: `Rola ${action.role} pre ${action.userId.slice(0, 8)}…`,
        after: { role: action.role, implementer: action.implementer || null },
      });
    }
    toast({ title: "Používateľ pridaný" });
    setNewUserId("");
    void load();
  };

  const addUser = () => {
    const uid = newUserId.trim();
    if (!uid) {
      toast({ title: "Zadaj user UUID", variant: "destructive" });
      return;
    }
    setPending({
      kind: "add",
      userId: uid,
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
        summary: `Odstránená rola ${action.role}`,
        before: { role: action.role },
      });
    }
    toast({ title: "Rola odstránená" });
    void load();
  };

  const removeRole = (roleRowId: string, userId: string, role: string) => {
    setPending({ kind: "remove", roleRowId, userId, role });
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
        summary: `Team profile → ${action.implementer}`,
        before: action.previous ? { implementer_name: action.previous } : null,
        after: { implementer_name: action.implementer },
      });
    }
    toast({ title: "Team profile priradený" });
    void load();
  };

  const confirmPending = async () => {
    if (!pending) return;
    const p = pending;
    setPending(null);
    if (p.kind === "add") await executeAddUser(p);
    if (p.kind === "remove") await executeRemoveRole(p);
    if (p.kind === "assign") await executeAssignProfile(p);
  };

  const profileFor = (userId: string) => profiles.find((p) => p.user_id === userId);

  const assignProfile = (userId: string, implementerName: string) => {
    const prev = profileFor(userId)?.implementer_name ?? null;
    setPending({ kind: "assign", userId, implementer: implementerName, previous: prev });
  };

  const usersMissingProfile = roles.filter(
    (r) => r.role === "user" && !profileFor(r.user_id)?.active,
  );

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Admin vidí celé CRM a financie. User vidí len vlastné provízie — musí mať team profile s menom
        realizátora (rovnaké ako v províziách). UUID nájdete v Supabase Auth alebo debug stránke.
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
      <ul className="divide-y rounded-xl border text-sm">
        {roles.length === 0 && (
          <li className="p-4 text-muted-foreground italic">Žiadni používatelia s rolou.</li>
        )}
        {roles.map((r) => {
          const prof = profileFor(r.user_id);
          const missingProfile = r.role === "user" && !prof?.active;
          return (
            <li key={r.id} className="p-3 flex flex-wrap items-center gap-2 justify-between">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs truncate">{r.user_id}</p>
                <div className="flex gap-2 mt-1 flex-wrap items-center">
                  <Badge variant="outline">{r.role}</Badge>
                  {prof && (
                    <Badge variant="secondary" className="text-[10px]">
                      {prof.implementer_name}
                    </Badge>
                  )}
                  {missingProfile && (
                    <Badge variant="destructive" className="text-[10px]">
                      Chýba team profile
                    </Badge>
                  )}
                </div>
                {missingProfile && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {CRM_ASSIGNEES.map((name) => (
                      <Button
                        key={name}
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px]"
                        onClick={() => assignProfile(r.user_id, name)}
                      >
                        <UserPlus className="w-3 h-3 mr-0.5" /> {name}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="text-destructive shrink-0"
                onClick={() => removeRole(r.id, r.user_id, r.role)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </li>
          );
        })}
      </ul>
      <div className="rounded-xl border p-4 space-y-3 bg-muted/20">
        <h3 className="text-sm font-semibold">Pridať používateľa</h3>
        <div className="space-y-1.5">
          <Label className="text-xs">User UUID (auth.users)</Label>
          <Input value={newUserId} onChange={(e) => setNewUserId(e.target.value)} placeholder="550e8400-..." />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Rola</Label>
            <Select value={newRole} onValueChange={(v) => setNewRole(v as "admin" | "user")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CRM_ASSIGNEES.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        {newRole === "user" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Zobrazované meno</Label>
            <Input value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} placeholder={newImplementer} />
          </div>
        )}
        <Button size="sm" onClick={addUser}>
          <Plus className="w-4 h-4 mr-1" /> Pridať
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
                Používateľ <code className="text-xs">{pending.userId}</code> dostane rolu{" "}
                <strong>{pending.role}</strong>.
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
              <p>Odstránite rolu {pending.role} pre účet {pending.userId.slice(0, 8)}…</p>
              <p>Používateľ stratí prístup k CRM, ak nemá inú rolu.</p>
            </>
          ) : pending?.kind === "assign" ? (
            <>
              <p>
                Mapovanie účtu na implementera <strong>{pending.implementer}</strong> určuje, ktoré
                provízie uvidí v Financiách.
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
