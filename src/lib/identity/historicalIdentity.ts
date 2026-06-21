/**
 * Historical CRM identity labels — removed users / inactive implementers in business context.
 */

export const HISTORICAL_ROLE_SUFFIX = "(historická rola — neaktívna)";

export type CrmUserArchiveRow = {
  user_id: string;
  email: string;
  display_name: string;
  historical_implementer_name: string | null;
  removed_at: string;
  removed_by_user_id: string | null;
};

export type HistoricalIdentityContext = {
  archivedUserIds: Set<string>;
  archivedImplementerNames: Set<string>;
  archivedUserLabels: Map<string, string>;
  activeImplementerNames: Set<string>;
  /** Deactivated crm_implementers rows — still valid historical commission strings. */
  inactiveRegistryImplementerNames: Set<string>;
};

function normKey(value: string): string {
  return value.trim().toLowerCase();
}

export function buildHistoricalIdentityContext(input: {
  archives: CrmUserArchiveRow[];
  activeImplementerNames: readonly string[];
  inactiveRegistryImplementerNames?: readonly string[];
}): HistoricalIdentityContext {
  const archivedUserIds = new Set<string>();
  const archivedImplementerNames = new Set<string>();
  const archivedUserLabels = new Map<string, string>();
  const activeImplementerNames = new Set(
    input.activeImplementerNames.map(normKey).filter(Boolean),
  );
  const inactiveRegistryImplementerNames = new Set(
    (input.inactiveRegistryImplementerNames ?? []).map(normKey).filter(Boolean),
  );

  for (const row of input.archives) {
    archivedUserIds.add(row.user_id);
    const label = row.display_name?.trim() || row.email?.trim() || row.user_id;
    archivedUserLabels.set(row.user_id, label);
    if (row.historical_implementer_name?.trim()) {
      archivedImplementerNames.add(normKey(row.historical_implementer_name));
    }
  }

  return {
    archivedUserIds,
    archivedImplementerNames,
    archivedUserLabels,
    activeImplementerNames,
    inactiveRegistryImplementerNames,
  };
}

export function isHistoricalImplementerName(
  name: string | null | undefined,
  ctx: HistoricalIdentityContext,
): boolean {
  const key = name?.trim();
  if (!key) return false;
  const normalized = normKey(key);
  if (ctx.activeImplementerNames.has(normalized)) return false;
  if (ctx.archivedImplementerNames.has(normalized)) return true;
  return ctx.inactiveRegistryImplementerNames.has(normalized);
}

export function isArchivedCrmUser(userId: string | null | undefined, ctx: HistoricalIdentityContext): boolean {
  if (!userId) return false;
  return ctx.archivedUserIds.has(userId);
}

export function formatImplementerLabel(
  name: string | null | undefined,
  ctx: HistoricalIdentityContext | null | undefined,
): string {
  const base = name?.trim();
  if (!base) return "—";
  if (!ctx || !isHistoricalImplementerName(base, ctx)) return base;
  return `${base} ${HISTORICAL_ROLE_SUFFIX}`;
}

export function formatActorLabel(
  userId: string | null | undefined,
  liveName: string | null | undefined,
  ctx: HistoricalIdentityContext | null | undefined,
): string {
  if (!userId && !liveName) return "systém";
  const archivedLabel = userId && ctx ? ctx.archivedUserLabels.get(userId) : undefined;
  const base = liveName?.trim() || archivedLabel || userId || "—";
  if (userId && ctx && isArchivedCrmUser(userId, ctx)) {
    return `${base} ${HISTORICAL_ROLE_SUFFIX}`;
  }
  return base;
}

export function activeAssigneeOptions(
  allOptions: readonly string[],
  ctx: HistoricalIdentityContext | null | undefined,
): string[] {
  if (!ctx) return [...allOptions];
  return allOptions.filter((name) => !isHistoricalImplementerName(name, ctx));
}
