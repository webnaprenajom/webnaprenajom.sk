import { useEffect, useMemo, useState } from "react";
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
import { AdminDialog } from "@/components/admin/AdminDialog";
import { useAdminCloseGuard } from "@/hooks/useAdminCloseGuard";
import type { CrmImplementerRow, ImplementerRegistryEntry } from "@/lib/admin/implementerRegistry";
import type { CrmManagedUser } from "@/lib/admin/crmUserDirectory";
import {
  applyImplementerCatalogEdit,
  listAssignableUsersForImplementer,
  validateImplementerCatalogEdit,
  type ImplementerCatalogEditDraft,
} from "@/lib/admin/implementerCatalogEdit";
import { AUDIT_ACTION_TYPES, logAdminAuditEvent } from "@/lib/audit/auditLog";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { toast } from "@/hooks/use-toast";

const UNASSIGNED = "__none__";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: ImplementerRegistryEntry | null;
  registry: CrmImplementerRow[];
  managedUsers: CrmManagedUser[];
  onSaved: () => void | Promise<void>;
};

function draftFromEntry(entry: ImplementerRegistryEntry): ImplementerCatalogEditDraft {
  return {
    name: entry.name,
    assignedUserId: entry.assignedUserId,
  };
}

export function ImplementerEditDialog({
  open,
  onOpenChange,
  entry,
  registry,
  managedUsers,
  onSaved,
}: Props) {
  const { userId: actorId, role: actorRole } = useAdminAccess();
  const editScope = useMemo(
    () => ({
      actorIsOwner: actorRole === "owner",
      actorUserId: actorId,
    }),
    [actorRole, actorId],
  );
  const [form, setForm] = useState<ImplementerCatalogEditDraft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && entry) setForm(draftFromEntry(entry));
    if (!open) setForm(null);
  }, [open, entry]);

  const validation = useMemo(() => {
    if (!entry || !form) return null;
    return validateImplementerCatalogEdit({
      entry,
      draft: form,
      registry,
      managedUsers,
      scope: editScope,
    });
  }, [entry, form, registry, managedUsers, editScope]);

  const assignableUsers = useMemo(() => {
    if (!entry) return [];
    return listAssignableUsersForImplementer(
      managedUsers,
      form?.name ?? entry.name,
      entry.assignedUserId,
      editScope,
    );
  }, [entry, form?.name, managedUsers, editScope]);

  const save = async (): Promise<boolean> => {
    if (!entry || !form || !validation?.ok) {
      toast({
        title: "Úprava nie je možná",
        description: validation?.error ?? "Skontrolujte formulár.",
        variant: "destructive",
      });
      return false;
    }
    setSaving(true);
    try {
      const { finalName } = await applyImplementerCatalogEdit({
        entry,
        draft: form,
        managedUsers,
        registry,
        scope: editScope,
      });
      if (actorId) {
        void logAdminAuditEvent({
          actorUserId: actorId,
          actionType: AUDIT_ACTION_TYPES.team_profile_updated,
          targetType: "implementer",
          targetId: finalName,
          summary: `Upravený realizátor v katalógu: ${entry.name} → ${finalName}`,
          before: {
            name: entry.name,
            assigned_user_id: entry.assignedUserId,
          },
          after: {
            name: finalName,
            assigned_user_id: form.assignedUserId,
          },
        });
      }
      toast({ title: "Realizátor uložený", description: finalName });
      await onSaved();
      onOpenChange(false);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Chyba";
      toast({ title: "Uloženie zlyhalo", description: msg, variant: "destructive" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const closeGuard = useAdminCloseGuard({
    isOpen: open,
    current: form,
    normalize: (d) => d,
    onSave: save,
    onDiscard: () => setForm(entry ? draftFromEntry(entry) : null),
    saving,
  });

  const requestClose = () => closeGuard.requestClose(() => onOpenChange(false));

  if (!entry || !form) return null;

  return (
    <>
      <AdminDialog
        open={open}
        onOpenChange={(next) => closeGuard.handleOpenChange(next, requestClose)}
        title="Upraviť realizátora"
        description="Mení živý katalóg a RBAC profil. Historické provízie a záznamy sa nemenia."
        size="md"
        stickyFooter
        footer={
          <>
            <Button type="button" variant="outline" onClick={requestClose} disabled={saving}>
              Zrušiť
            </Button>
            <Button
              type="button"
              onClick={() => void save()}
              disabled={saving || !validation?.ok}
            >
              Uložiť
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Meno realizátora</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
              disabled={!entry.inRegistry && !entry.assignedUserId}
            />
            {!entry.inRegistry && !entry.assignedUserId && (
              <p className="text-xs text-muted-foreground">
                Meno nie je v registri — najprv pridajte realizátora alebo priraďte účet.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Priradený účet</Label>
            <Select
              value={form.assignedUserId ?? UNASSIGNED}
              onValueChange={(v) =>
                setForm((prev) =>
                  prev
                    ? { ...prev, assignedUserId: v === UNASSIGNED ? null : v }
                    : prev,
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Vyberte účet…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>— Nepriradené —</SelectItem>
                {assignableUsers.map((user) => (
                  <SelectItem key={user.userId} value={user.userId}>
                    {user.displayName}
                    {user.email ? ` (${user.email})` : ""}
                    {user.role === "owner" ? " · owner" : ""}
                    {user.missingProfile ? " · bez profilu" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {assignableUsers.length === 0 && (
              <p className="text-xs text-muted-foreground">
                {editScope.actorIsOwner
                  ? "Žiadny voľný CRM účet (owner/administrator). Pridajte používateľa vyššie alebo uvoľnite existujúce priradenie."
                  : "Môžete priradiť realizátora len k vlastnému účtu administrator."}
              </p>
            )}
          </div>

          {validation?.warnings.map((warning) => (
            <p key={warning} className="text-xs text-amber-700 dark:text-amber-400">
              {warning}
            </p>
          ))}
          {validation && !validation.ok && validation.error && (
            <p className="text-xs text-destructive">{validation.error}</p>
          )}
        </div>
      </AdminDialog>
      {closeGuard.closeGuardDialog}
    </>
  );
}
