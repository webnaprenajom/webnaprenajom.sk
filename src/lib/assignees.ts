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

export function isKnownAssignee(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  return (CRM_ASSIGNEES as readonly string[]).includes(name.trim());
}
