import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { useImplementerRegistry } from "@/hooks/useImplementerRegistry";
import {
  buildImplementerRegistryEntries,
  normalizeImplementerName,
  implementerRegistryNameTaken,
} from "@/lib/admin/implementerRegistry";
import type { CrmManagedUser } from "@/lib/admin/crmUserDirectory";
import { ConfirmSensitiveActionDialog } from "@/components/admin/rbac/ConfirmSensitiveActionDialog";
import { AUDIT_ACTION_TYPES, logAdminAuditEvent } from "@/lib/audit/auditLog";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { adminCtrl } from "@/lib/admin/readability";

type RegistryApi = Pick<
  ReturnType<typeof useImplementerRegistry>,
  "rows" | "loading" | "error" | "createName" | "deactivateName" | "reactivateName" | "reload"
>;

type Props = {
  registry: RegistryApi;
  managedUsers: CrmManagedUser[];
};

export function ImplementerRegistryPanel({ registry, managedUsers }: Props) {
  const { userId: actorId } = useAdminAccess();
  const [newName, setNewName] = useState("");
  const [pendingDeactivate, setPendingDeactivate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const entries = useMemo(
    () => buildImplementerRegistryEntries(registry.rows, managedUsers),
    [registry.rows, managedUsers],
  );

  const addImplementer = async () => {
    const normalized = normalizeImplementerName(newName);
    if (!normalized) {
      toast({
        title: "Neplatné meno",
        description: "Meno musí mať aspoň 2 znaky a nesmie obsahovať rezervovaný suffix.",
        variant: "destructive",
      });
      return;
    }
    if (implementerRegistryNameTaken(registry.rows, normalized)) {
      toast({
        title: "Meno už existuje",
        description: "Aktívny realizátor s týmto menom je už v registri.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await registry.createName(normalized);
      if (actorId) {
        void logAdminAuditEvent({
          actorUserId: actorId,
          actionType: AUDIT_ACTION_TYPES.finance_config_changed,
          targetType: "implementer",
          targetId: normalized,
          summary: `Pridaný realizátor do registra: ${normalized}`,
          after: { name: normalized, active: true },
        });
      }
      toast({ title: "Realizátor pridaný", description: normalized });
      setNewName("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Chyba";
      toast({ title: "Nepodarilo sa pridať", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const confirmDeactivate = async () => {
    if (!pendingDeactivate) return;
    const name = pendingDeactivate;
    setPendingDeactivate(null);
    setSaving(true);
    try {
      await registry.deactivateName(name);
      if (actorId) {
        void logAdminAuditEvent({
          actorUserId: actorId,
          actionType: AUDIT_ACTION_TYPES.finance_config_changed,
          targetType: "implementer",
          targetId: name,
          summary: `Deaktivovaný realizátor v registri: ${name}`,
          before: { active: true },
          after: { active: false },
        });
      }
      toast({ title: "Realizátor deaktivovaný", description: name });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Chyba";
      toast({ title: "Chyba", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (registry.loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
      </div>
    );
  }

  if (registry.error) {
    return (
      <p className="text-xs text-destructive">
        Register realizátorov sa nepodarilo načítať: {registry.error}. Spustite migráciu{" "}
        <code className="text-[10px]">20260624120000_crm_implementer_registry</code>.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-2 items-end">
        <div className="space-y-1 flex-1 min-w-[12rem]">
          <Label className="text-xs">Nové meno realizátora</Label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="napr. Ján"
            className="h-9"
          />
        </div>
        <Button size="sm" onClick={() => void addImplementer()} disabled={saving || !newName.trim()}>
          <Plus className="w-4 h-4 mr-1" /> Pridať
        </Button>
      </div>

      <div className="rounded-lg border overflow-x-auto table-dense">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Meno</TableHead>
              <TableHead>Stav</TableHead>
              <TableHead>Priradený účet</TableHead>
              <TableHead className="text-right">Akcie</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground text-xs py-6">
                  Žiadni realizátori v registri.
                </TableCell>
              </TableRow>
            )}
            {entries.map((entry) => (
              <TableRow key={entry.name}>
                <TableCell className="font-medium text-sm">{entry.name}</TableCell>
                <TableCell>
                  {!entry.active ? (
                    <Badge variant="secondary" className="text-[10px]">
                      Neaktívny
                    </Badge>
                  ) : entry.assignedUserId ? (
                    <Badge variant="outline" className="text-[10px] text-green-600 border-green-500/40">
                      Priradený
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      Voľný
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {entry.assignedDisplayName ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  {entry.active && !entry.assignedUserId && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className={`${adminCtrl.sm} text-destructive/80 hover:text-destructive hover:bg-destructive/10`}
                      disabled={saving}
                      onClick={() => setPendingDeactivate(entry.name)}
                    >
                      Deaktivovať
                    </Button>
                  )}
                  {!entry.active && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7"
                      disabled={saving}
                      onClick={() => void registry.reactivateName(entry.name)}
                    >
                      Obnoviť
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ConfirmSensitiveActionDialog
        open={!!pendingDeactivate}
        onOpenChange={(o) => !o && setPendingDeactivate(null)}
        title="Deaktivovať realizátora v registri?"
        description={
          pendingDeactivate ? (
            <>
              <p>
                Meno <strong>{pendingDeactivate}</strong> nebude ponúkané pri nových priradeniach.
              </p>
              <p className="text-muted-foreground mt-1">
                Historické provízie s týmto menom ostávajú nedotknuté.
              </p>
            </>
          ) : null
        }
        confirmLabel="Deaktivovať"
        destructive
        onConfirm={() => void confirmDeactivate()}
      />
    </div>
  );
}
