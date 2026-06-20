import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

export interface UnsavedChangesAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving?: boolean;
  onSave: () => void | Promise<void>;
  onDiscard: () => void;
}

/** Shared Save / Discard / Cancel prompt for admin edit modals. */
export function UnsavedChangesAlertDialog({
  open,
  onOpenChange,
  saving = false,
  onSave,
  onDiscard,
}: UnsavedChangesAlertDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Neuložené zmeny</AlertDialogTitle>
          <AlertDialogDescription>
            Zmeny nie sú uložené. Ak odídeš, môžu sa stratiť. Chceš uložiť, pokračovať bez uloženia,
            alebo zostať?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel disabled={saving} onClick={() => onOpenChange(false)}>
            Zostať
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={saving}
            onClick={(e) => {
              e.preventDefault();
              onDiscard();
            }}
          >
            Pokračovať bez uloženia
          </AlertDialogAction>
          <AlertDialogAction
            disabled={saving}
            onClick={(e) => {
              e.preventDefault();
              void onSave();
            }}
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Uložiť
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
