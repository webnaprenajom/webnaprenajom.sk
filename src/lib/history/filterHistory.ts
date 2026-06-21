import type { HistoryEntry, HistoryFilters } from "@/lib/history/types";

function matchesDateRange(iso: string, from: string, to: string): boolean {
  const t = new Date(iso).getTime();
  if (from) {
    const start = new Date(`${from}T00:00:00`).getTime();
    if (t < start) return false;
  }
  if (to) {
    const end = new Date(`${to}T23:59:59.999`).getTime();
    if (t > end) return false;
  }
  return true;
}

export function filterHistoryEntries(
  entries: HistoryEntry[],
  filters: HistoryFilters,
): HistoryEntry[] {
  const q = filters.search.trim().toLowerCase();
  return entries.filter((e) => {
    if (filters.module !== "all" && e.module !== filters.module) return false;
    if (filters.actionType !== "all" && e.actionType !== filters.actionType) return false;
    if (filters.entityType !== "all" && e.entityType !== filters.entityType) return false;
    if (filters.actor !== "all") {
      const actorKey = e.actorId ?? e.actorName ?? "system";
      if (actorKey !== filters.actor) return false;
    }
    if (!matchesDateRange(e.occurredAt, filters.dateFrom, filters.dateTo)) return false;
    if (q) {
      const hay = [
        e.summary,
        e.actionLabel,
        e.entityLabel,
        e.entityId,
        e.actorName,
        e.module,
        e.entityType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function collectHistoryFilterOptions(entries: HistoryEntry[]): {
  modules: string[];
  actionTypes: { value: string; label: string }[];
  entityTypes: { value: string; label: string }[];
  actors: { value: string; label: string }[];
} {
  const modules = new Set<string>();
  const actionMap = new Map<string, string>();
  const entityMap = new Map<string, string>();
  const actorMap = new Map<string, string>();

  for (const e of entries) {
    modules.add(e.module);
    actionMap.set(e.actionType, e.actionLabel);
    entityMap.set(e.entityType, e.entityType);
    const actorKey = e.actorId ?? e.actorName ?? "system";
    const actorLabel = e.actorName ?? (e.actorType === "system" ? "systém" : actorKey);
    actorMap.set(actorKey, actorLabel);
  }

  return {
    modules: [...modules].sort(),
    actionTypes: [...actionMap.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "sk")),
    entityTypes: [...entityMap.entries()]
      .map(([value]) => ({ value, label: value }))
      .sort((a, b) => a.label.localeCompare(b.label, "sk")),
    actors: [...actorMap.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "sk")),
  };
}
