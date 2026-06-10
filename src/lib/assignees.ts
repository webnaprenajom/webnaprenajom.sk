/** Shared CRM assignees / implementers — single source of truth. */

export const CRM_ASSIGNEES = ["Peter", "Maroš", "Matuš"] as const;

export type CrmAssignee = (typeof CRM_ASSIGNEES)[number];

/** Include legacy DB value at top when not in canonical list. */
export function assigneeSelectOptions(current?: string | null): string[] {
  const options: string[] = [...CRM_ASSIGNEES];
  const value = current?.trim();
  if (value && !options.includes(value)) {
    options.unshift(value);
  }
  return options;
}

export function isKnownAssignee(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  return (CRM_ASSIGNEES as readonly string[]).includes(name.trim());
}
