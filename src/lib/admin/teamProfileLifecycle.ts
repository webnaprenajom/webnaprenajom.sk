/**
 * team_profiles lifecycle helpers — deactivate on offboard, free implementer_name slot.
 * ponytail: UNIQUE(implementer_name) is global; archive name on deactivate so slot can be reused.
 */

export function archiveImplementerNameOnDeactivate(
  implementerName: string,
  userId: string,
): string {
  const base = implementerName.trim();
  const suffix = userId.replace(/-/g, "").slice(0, 8);
  return `${base}__off__${suffix}`;
}

export type TeamProfileDeactivateUpdate = {
  active: false;
  implementer_name: string;
};

export function buildTeamProfileDeactivateUpdate(
  userId: string,
  implementerName: string,
): TeamProfileDeactivateUpdate {
  return {
    active: false,
    implementer_name: archiveImplementerNameOnDeactivate(implementerName, userId),
  };
}

export function normalizeTeamDisplayName(
  displayName: string,
  fallbackImplementer: string,
): string {
  const trimmed = displayName.trim();
  return trimmed || fallbackImplementer.trim();
}
