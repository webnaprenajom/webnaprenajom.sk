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
  /** Modal identifier, e.g. `lead-detail` */
  modalId: string;
  /** Current route path, e.g. `/admin` */
  route: string;
  /** Entity id or `new` for create flows */
  entityId: string | "new";
  /** Whether the modal/form is currently open */
  isActive: boolean;
  /** Live form data to autosave */
  data: T;
  /** Baseline snapshot for dirty flag (captured when modal opens) */
  baseline?: T | null;
  normalize?: (value: T) => unknown;
  debounceMs?: number;
  /** Called once when a stored draft should hydrate form state */
  onRestore: (data: T) => void;
}

/**
 * Autosave form drafts (debounced) + restore on modal open.
 * Flush on visibility hidden / beforeunload so tab-switch doesn't lose data.
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

  // Capture baseline when modal opens
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

  // Restore draft once per open cycle
  useEffect(() => {
    if (!isActive || restoredRef.current) return;
    restoredRef.current = true;
    const stored = loadCrmDraft<T>(key);
    if (stored?.data) {
      onRestoreRef.current(stored.data);
    }
  }, [isActive, key]);

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

  // Debounced autosave
  useEffect(() => {
    if (!isActive) return;
    const t = window.setTimeout(flush, debounceMs);
    return () => window.clearTimeout(t);
  }, [isActive, data, debounceMs, flush]);

  // Flush before tab hide / unload
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

  return { discardDraft, flushDraft: flush, draftKey: key };
}
