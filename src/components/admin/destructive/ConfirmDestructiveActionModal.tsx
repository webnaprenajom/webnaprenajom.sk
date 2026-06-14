import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DestructiveImpactSummaryView } from "@/components/admin/destructive/DestructiveImpactSummaryView";
import {
  destructiveEntityTypeLabel,
  type DestructiveImpactSummary,
} from "@/lib/destructive/types";
import { AlertCircle, Loader2 } from "lucide-react";

export interface ConfirmDestructiveActionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  impact: DestructiveImpactSummary | null;
  loading?: boolean;
  executing?: boolean;
  error?: string | null;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDestructiveActionModal({
  open,
  onOpenChange,
  impact,
  loading = false,
  executing = false,
  error = null,
  onConfirm,
}: ConfirmDestructiveActionModalProps) {
  const entityLabel = impact?.entity_label ?? "—";
  const entityType = impact?.entity_type;
  const canDelete = impact?.can_delete ?? false;
  const busy = loading || executing;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg w-[calc(100vw-1.5rem)] sm:w-full max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>
            Zmazať {entityType ? destructiveEntityTypeLabel(entityType).toLowerCase() : "záznam"}?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Chystáte sa <strong className="text-foreground">natrvalo zmazať</strong>{" "}
                <strong className="text-foreground">{entityLabel}</strong>. Túto akciu nie je možné
                vrátiť späť.
              </p>
              {loading && (
                <div className="flex items-center gap-2 py-4 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">Analyzujem dopady…</span>
                </div>
              )}
              {!loading && impact && <DestructiveImpactSummaryView impact={impact} />}
              {error && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 flex gap-2 text-xs text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel className="w-full sm:w-auto" disabled={executing}>
            Zrušiť
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            className="w-full sm:w-auto"
            disabled={busy || !canDelete || !impact}
            onClick={() => void onConfirm()}
          >
            {executing ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Mažem…
              </>
            ) : canDelete ? (
              "Natrvalo zmazať"
            ) : (
              "Zmazanie zablokované"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
