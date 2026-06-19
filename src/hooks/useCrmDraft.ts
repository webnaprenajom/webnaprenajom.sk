import { useCallback, useEffect, useRef } from "react";
import {
  buildDraftKey,
  clearCrmDraft,
  loadCrmDraft,
  saveCrmDraft,
  type CrmDraftRecord,
} from "@/lib/crmPersistence/draftStore";

const DEFAULT_DEBOUNCE_MS = 400;

export interface UseCrmDraftOptions<T> {
  modalId: string;
  route: string;
  entityId: string | "new";
  isActive: boolean;
  data: T;
  baseline?: T | null;
  normalize?: (value: T) => unknown;
  debounceMs?: number;
  onRestore: (data: T) => void;
}

/**
 * Autosave form drafts (debounced) + restore on modal open.
 * Restore applies only when draft is dirty AND differs from server baseline.
 */
export function useCrmDraft<T>({
  modalId,
  route,
  entityId,
  isActive,
  data,
  baseline = null,
  normalize = (v) => v,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  onRestore,
}: UseCrmDraftOptions<T>) {
  const key = buildDraftKey(modalId, entityId);
  const restoredRef = useRef(false);
  const baselineRef = useRef<string | null>(null);
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;

  useEffect(() => {
    if (isActive && baselineRef.current === null) {
      baselineRef.current = JSON.stringify(normalize(baseline ?? data));
    }
    if (!isActive) {
      baselineRef.current = null;
      restoredRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  useEffect(() => {
    if (!isActive || restoredRef.current) return;
    restoredRef.current = true;

    const stored = loadCrmDraft<T>(key);
    if (!stored?.data || !stored.meta?.dirty) {
      if (stored) clearCrmDraft(key);
      return;
    }

    const draftSnap = JSON.stringify(normalize(stored.data));
    const baseSnap = baselineRef.current;
    if (baseSnap !== null && draftSnap === baseSnap) {
      clearCrmDraft(key);
      return;
    }

    onRestoreRef.current(stored.data);
  }, [isActive, key, normalize]);

  const flush = useCallback(() => {
    if (!isActive) return;
    const currentSnap = JSON.stringify(normalize(data));
    const dirty =
      baselineRef.current !== null && currentSnap !== baselineRef.current;
    if (!dirty) {
      clearCrmDraft(key);
      return;
    }
    const record: CrmDraftRecord<T> = {
      meta: {
        route,
        modalId,
        entityId,
        updatedAt: Date.now(),
        dirty: true,
      },
      data,
    };
    saveCrmDraft(key, record);
  }, [isActive, data, entityId, key, modalId, normalize, route]);

  useEffect(() => {
    if (!isActive) return;
    const t = window.setTimeout(flush, debounceMs);
    return () => window.clearTimeout(t);
  }, [isActive, data, debounceMs, flush]);

  useEffect(() => {
    if (!isActive) return;
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const onUnload = () => flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [isActive, flush]);

  const discardDraft = useCallback(() => {
    clearCrmDraft(key);
    baselineRef.current = JSON.stringify(normalize(data));
  }, [data, key, normalize]);

  const clearDraft = useCallback(() => {
    clearCrmDraft(key);
    baselineRef.current = null;
  }, [key]);

  return { discardDraft, clearDraft, flushDraft: flush, draftKey: key };
}
