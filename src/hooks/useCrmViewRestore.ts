import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  loadCrmViewState,
  saveCrmViewState,
  type CrmViewRestoreState,
} from "@/lib/crmPersistence/viewRestoreStore";

export interface UseCrmViewRestoreOptions {
  /** Route this hook manages, e.g. `/admin/rentals` */
  route: string;
  modalId?: string;
  entityId?: string | null;
  section?: string;
  /** Extra query params to persist (e.g. `{ edit: id }`) */
  query?: Record<string, string>;
  /** Whether modal is currently open — only persist when true */
  isModalOpen?: boolean;
  /** Called when returning to CRM tab with matching saved state */
  onRestore?: (state: CrmViewRestoreState) => void;
  /** Skip restore (e.g. while auth loading) */
  enabled?: boolean;
}

/**
 * Persist last admin view/modal position; restore on visibility return to same route.
 * Never restores destructive confirm modals — caller must not pass those modalIds.
 */
export function useCrmViewRestore({
  route,
  modalId,
  entityId,
  section,
  query,
  isModalOpen = false,
  onRestore,
  enabled = true,
}: UseCrmViewRestoreOptions) {
  const location = useLocation();
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;
  const restoredRef = useRef(false);

  // Persist when modal open or section changes
  useEffect(() => {
    if (!enabled) return;
    if (!isModalOpen && !section && !entityId) return;
    saveCrmViewState({
      route,
      modalId: isModalOpen ? modalId : undefined,
      entityId: entityId ?? undefined,
      section,
      query,
    });
  }, [enabled, route, modalId, entityId, section, query, isModalOpen]);

  // Restore on mount + when tab becomes visible again
  useEffect(() => {
    if (!enabled || !onRestoreRef.current) return;

    const tryRestore = () => {
      if (location.pathname !== route) return;
      const saved = loadCrmViewState();
      if (!saved || saved.route !== route) return;
      if (saved.modalId && saved.modalId.includes("destructive")) return;
      onRestoreRef.current?.(saved);
    };

    if (!restoredRef.current) {
      restoredRef.current = true;
      tryRestore();
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") tryRestore();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [enabled, location.pathname, route]);
}
