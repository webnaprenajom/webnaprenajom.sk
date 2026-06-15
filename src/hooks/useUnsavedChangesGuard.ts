import { useEffect, useRef } from "react";

/**
 * Phase 1 PoC — unsaved-changes guard for AdminDialog-based forms.
 *
 * Tracks a normalized snapshot of `current` captured at the moment the dialog
 * transitions from closed -> open, and reports whether `current` has since
 * diverged from that snapshot.
 *
 * `confirmDiscard()` should be called by every close path (Zrušiť button,
 * AdminDialog onOpenChange from ESC/overlay) before actually closing. If the
 * form is dirty it shows a window.confirm; if the user confirms (or the form
 * was never dirty), it returns true and the caller proceeds to close.
 *
 * Save flows are untouched: closing after a successful save happens while
 * `isOpen` is still true for this render, but callers should not route the
 * post-save close through `confirmDiscard()` — they should close directly.
 */
export function useUnsavedChangesGuard<T>({
  isOpen,
  current,
  normalize = (value: T) => value,
  confirmMessage = "Neuložené zmeny budú zahodené. Naozaj zavrieť?",
}: {
  isOpen: boolean;
  current: T;
  normalize?: (value: T) => unknown;
  confirmMessage?: string;
}): { isDirty: boolean; confirmDiscard: () => boolean } {
  const snapshotRef = useRef<string | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      // Just opened — capture the baseline snapshot.
      snapshotRef.current = JSON.stringify(normalize(current));
    } else if (!isOpen) {
      snapshotRef.current = null;
    }
    wasOpenRef.current = isOpen;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const isDirty =
    isOpen &&
    snapshotRef.current !== null &&
    JSON.stringify(normalize(current)) !== snapshotRef.current;

  const confirmDiscard = () => {
    if (!isDirty) return true;
    return window.confirm(confirmMessage);
  };

  return { isDirty, confirmDiscard };
}
