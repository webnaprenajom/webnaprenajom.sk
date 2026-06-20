import { useMemo } from "react";
import { assigneeSelectOptions, isKnownAssignee } from "@/lib/assignees";
import { useImplementerRegistry } from "@/hooks/useImplementerRegistry";

/** Active registry names + legacy-safe options for implementer Select fields. */
export function useImplementerSelectOptions(current?: string | null) {
  const registry = useImplementerRegistry();

  const options = useMemo(
    () => assigneeSelectOptions(current, registry.activeNames),
    [current, registry.activeNames],
  );

  const isKnown = useMemo(
    () => (name: string) => isKnownAssignee(name, registry.activeNames),
    [registry.activeNames],
  );

  return {
    options,
    loading: registry.loading,
    error: registry.error,
    activeNames: registry.activeNames,
    isKnown,
  };
}
