import { useCallback, useRef, useState } from "react";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { UnsavedChangesAlertDialog } from "@/components/admin/UnsavedChangesAlertDialog";

export interface UseAdminCloseGuardOptions<T> {
  isOpen: boolean;
  current: T;
  normalize?: (value: T) => unknown;
  /** Existing save flow — return true when save succeeded and modal may close */
  onSave: () => boolean | Promise<boolean>;
  /** Called when user discards — clear draft etc. */
  onDiscard?: () => void;
  saving?: boolean;
}

/**
 * Enterprise close guard: ESC / overlay / cancel → Save · Discard · Cancel.
 * Built on useUnsavedChangesGuard — dirty detection only, no window.confirm.
 */
export function useAdminCloseGuard<T>({
  isOpen,
  current,
  normalize,
  onSave,
  onDiscard,
  saving = false,
}: UseAdminCloseGuardOptions<T>) {
  const { isDirty } = useUnsavedChangesGuard({ isOpen, current, normalize });
  const [promptOpen, setPromptOpen] = useState(false);
  const pendingCloseRef = useRef<(() => void) | null>(null);

  const requestClose = useCallback(
    (closeFn: () => void) => {
      if (!isDirty) {
        closeFn();
        return;
      }
      pendingCloseRef.current = closeFn;
      setPromptOpen(true);
    },
    [isDirty],
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean, closeFn: () => void) => {
      if (nextOpen) return;
      requestClose(closeFn);
    },
    [requestClose],
  );

  const finishClose = useCallback(() => {
    pendingCloseRef.current?.();
    pendingCloseRef.current = null;
    setPromptOpen(false);
  }, []);

  const handleDiscard = useCallback(() => {
    onDiscard?.();
    finishClose();
  }, [finishClose, onDiscard]);

  const handleSave = useCallback(async () => {
    const ok = await onSave();
    if (ok) finishClose();
  }, [finishClose, onSave]);

  const closeGuardDialog = (
    <UnsavedChangesAlertDialog
      open={promptOpen}
      onOpenChange={(o) => {
        if (!o) {
          pendingCloseRef.current = null;
          setPromptOpen(false);
        }
      }}
      saving={saving}
      onSave={handleSave}
      onDiscard={handleDiscard}
    />
  );

  return {
    isDirty,
    requestClose,
    handleOpenChange,
    closeGuardDialog,
  };
}
