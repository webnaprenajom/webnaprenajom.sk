import { useCallback, useEffect, useRef, useState } from "react";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { UnsavedChangesAlertDialog } from "@/components/admin/UnsavedChangesAlertDialog";

export interface UseAdminCloseGuardOptions<T> {
  isOpen: boolean;
  current: T;
  normalize?: (value: T) => unknown;
  onSave: () => boolean | Promise<boolean>;
  onDiscard?: () => void;
  saving?: boolean;
  /** Reserved for future Data Router — ignored under BrowserRouter (ponytail). */
  blockRouteChanges?: boolean;
}

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
  const pendingProceedRef = useRef<(() => void) | null>(null);

  const requestClose = useCallback(
    (closeFn: () => void, proceed?: () => void) => {
      if (!isDirty) {
        closeFn();
        proceed?.();
        return;
      }
      pendingCloseRef.current = closeFn;
      pendingProceedRef.current = proceed ?? null;
      setPromptOpen(true);
    },
    [isDirty],
  );

  /** Wrap programmatic navigate() — sidebar Link clicks are not intercepted under BrowserRouter. */
  const requestNavigate = useCallback(
    (navigateFn: () => void) => {
      requestClose(() => {}, navigateFn);
    },
    [requestClose],
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
    pendingProceedRef.current?.();
    pendingCloseRef.current = null;
    pendingProceedRef.current = null;
    setPromptOpen(false);
  }, []);

  const cancelClose = useCallback(() => {
    pendingCloseRef.current = null;
    pendingProceedRef.current = null;
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

  useEffect(() => {
    if (!isOpen || !isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isOpen, isDirty]);

  const closeGuardDialog = (
    <UnsavedChangesAlertDialog
      open={promptOpen}
      onOpenChange={(o) => {
        if (!o) cancelClose();
      }}
      saving={saving}
      onSave={handleSave}
      onDiscard={handleDiscard}
    />
  );

  return {
    isDirty,
    requestClose,
    requestNavigate,
    handleOpenChange,
    closeGuardDialog,
  };
}
