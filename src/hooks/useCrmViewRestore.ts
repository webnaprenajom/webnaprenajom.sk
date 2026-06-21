import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  buildPilotRestoreKey,
  loadCrmViewState,
  saveCrmViewState,
  type CrmViewRestoreState,
} from "@/lib/crmPersistence/viewRestoreStore";

export interface UseCrmViewRestoreOptions {
  route: string;
  modalId?: string;
  entityId?: string | null;
  section?: string;
  query?: Record<string, string>;
  isModalOpen?: boolean;
  onRestore?: (state: CrmViewRestoreState) => void;
  enabled?: boolean;
}

/**
 * Persist open modal while active; restore once per saved snapshot on mount only.
 * Tab focus/visibility must NOT re-trigger restore — in-memory modal state stays put.
 * Pilots must call clearCrmViewState() when modal closes (save / discard / clean close).
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
  const isModalOpenRef = useRef(isModalOpen);
  isModalOpenRef.current = isModalOpen;
  const appliedRestoreKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !isModalOpen || !modalId) return;
    saveCrmViewState({
      route,
      modalId,
      entityId: entityId ?? undefined,
      section,
      query,
    });
  }, [enabled, route, modalId, entityId, section, query, isModalOpen]);

  useEffect(() => {
    if (!enabled || !onRestoreRef.current) return;

    const tryRestore = () => {
      if (location.pathname !== route) return;
      if (isModalOpenRef.current) return;

      const saved = loadCrmViewState();
      if (!saved || saved.route !== route || !saved.modalId) return;
      if (saved.modalId.includes("destructive")) return;

      const restoreKey = buildPilotRestoreKey(saved);
      if (appliedRestoreKeyRef.current === restoreKey) return;

      appliedRestoreKeyRef.current = restoreKey;
      onRestoreRef.current?.(saved);
    };

    tryRestore();
  }, [enabled, location.pathname, route]);

  useEffect(() => {
    if (isModalOpen) appliedRestoreKeyRef.current = null;
  }, [isModalOpen]);
}
