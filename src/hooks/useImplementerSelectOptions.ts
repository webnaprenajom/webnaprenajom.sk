import { useMemo } from "react";
import { assigneeSelectOptions, isKnownAssignee } from "@/lib/assignees";
import { useImplementerRegistry } from "@/hooks/useImplementerRegistry";

/** Active registry names + legacy-safe options for implementer Select fields. */
export function useImplementerSelectOptions(current?: string | null) {
  const catalog = useImplementerRegistryOptions();
  const options = useMemo(
    () => catalog.optionsFor(current),
    [catalog.optionsFor, current],
  );
  return { ...catalog, options };
}

/** Registry catalog without binding to a single current value — for multi-row forms (e.g. rental splits). */
export function useImplementerRegistryOptions() {
  const registry = useImplementerRegistry();

  const optionsFor = useMemo(
    () => (current?: string | null) => assigneeSelectOptions(current, registry.activeNames),
    [registry.activeNames],
  );

  const isKnown = useMemo(
    () => (name: string) => isKnownAssignee(name, registry.activeNames),
    [registry.activeNames],
  );

  return {
    optionsFor,
    isKnown,
    loading: registry.loading,
    error: registry.error,
    activeNames: registry.activeNames,
  };
}
