/** Shared CRM assignees / implementers — seed list + dynamic registry in Settings. */

export const CRM_ASSIGNEES = ["Peter", "Maroš", "Matuš"] as const;

export type CrmAssignee = (typeof CRM_ASSIGNEES)[number];

/** Merge seed, registry, and optional current value for select options. */
export function assigneeSelectOptions(
  current?: string | null,
  registryNames: readonly string[] = [],
): string[] {
  const set = new Set<string>([...CRM_ASSIGNEES]);
  for (const name of registryNames) {
    const trimmed = name.trim();
    if (trimmed) set.add(trimmed);
  }
  const value = current?.trim();
  if (value) set.add(value);
  return [...set].sort((a, b) => a.localeCompare(b, "sk"));
}

export function isRegistryImplementer(
  name: string | null | undefined,
  activeRegistryNames: readonly string[],
): boolean {
  if (!name?.trim() || activeRegistryNames.length === 0) return false;
  const key = name.trim().toLowerCase();
  return activeRegistryNames.some((n) => n.trim().toLowerCase() === key);
}

/** Known in active registry when loaded; otherwise falls back to seed list. */
export function isKnownAssignee(
  name: string | null | undefined,
  activeRegistryNames: readonly string[] = [],
): boolean {
  if (!name?.trim()) return false;
  if (activeRegistryNames.length > 0) {
    return isRegistryImplementer(name, activeRegistryNames);
  }
  return (CRM_ASSIGNEES as readonly string[]).includes(name.trim());
}
