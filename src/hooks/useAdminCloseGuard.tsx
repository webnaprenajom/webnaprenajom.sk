import { useCallback, useEffect, useRef, useState } from "react";
import { useBlocker } from "react-router-dom";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { UnsavedChangesAlertDialog } from "@/components/admin/UnsavedChangesAlertDialog";

export interface UseAdminCloseGuardOptions<T> {
  isOpen: boolean;
  current: T;
  normalize?: (value: T) => unknown;
  onSave: () => boolean | Promise<boolean>;
  onDiscard?: () => void;
  saving?: boolean;
  /** Block in-app route changes while dirty (pilot pages). */
  blockRouteChanges?: boolean;
}

export function useAdminCloseGuard<T>({
  isOpen,
  current,
  normalize,
  onSave,
  onDiscard,
  saving = false,
  blockRouteChanges = true,
}: UseAdminCloseGuardOptions<T>) {
  const { isDirty } = useUnsavedChangesGuard({ isOpen, current, normalize });
  const [promptOpen, setPromptOpen] = useState(false);
  const pendingCloseRef = useRef<(() => void) | null>(null);
  const pendingProceedRef = useRef<(() => void) | null>(null);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      blockRouteChanges &&
      isOpen &&
      isDirty &&
      currentLocation.pathname !== nextLocation.pathname,
  );

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
    if (blocker.state === "blocked") blocker.reset?.();
  }, [blocker]);

  const handleDiscard = useCallback(() => {
    onDiscard?.();
    finishClose();
  }, [finishClose, onDiscard]);

  const handleSave = useCallback(async () => {
    const ok = await onSave();
    if (ok) finishClose();
  }, [finishClose, onSave]);

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    pendingCloseRef.current = () => {};
    pendingProceedRef.current = () => blocker.proceed?.();
    setPromptOpen(true);
  }, [blocker.state, blocker]);

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
    handleOpenChange,
    closeGuardDialog,
  };
}
