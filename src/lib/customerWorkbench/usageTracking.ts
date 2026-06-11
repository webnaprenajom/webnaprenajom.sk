/**
 * Lightweight workbench adoption counters (browser-local, no PII).
 * Batch I — diagnostic only, per-admin browser session persistence.
 */

const STORAGE_KEY = "crm_workbench_usage_v1";
const MAX_KEYS = 40;

export type WorkbenchUsageKind = "tab" | "quick_create" | "comm_filter";

function counterKey(kind: WorkbenchUsageKind, value: string): string {
  return `${kind}:${value}`;
}

function readStore(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, number>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // quota / private mode — ignore
  }
}

export function recordWorkbenchUsage(kind: WorkbenchUsageKind, value: string): void {
  const store = readStore();
  const key = counterKey(kind, value);
  store[key] = (store[key] ?? 0) + 1;

  const keys = Object.keys(store);
  if (keys.length > MAX_KEYS) {
    const sorted = keys.sort((a, b) => (store[b] ?? 0) - (store[a] ?? 0));
    const trimmed: Record<string, number> = {};
    for (const k of sorted.slice(0, MAX_KEYS)) trimmed[k] = store[k];
    writeStore(trimmed);
    return;
  }

  writeStore(store);
}

export interface WorkbenchUsageRow {
  kind: WorkbenchUsageKind;
  value: string;
  count: number;
}

export function getWorkbenchUsageRows(): WorkbenchUsageRow[] {
  const store = readStore();
  return Object.entries(store)
    .map(([key, count]) => {
      const [kind, ...rest] = key.split(":");
      if (kind !== "tab" && kind !== "quick_create" && kind !== "comm_filter") return null;
      return {
        kind: kind as WorkbenchUsageKind,
        value: rest.join(":"),
        count,
      };
    })
    .filter((row): row is WorkbenchUsageRow => row !== null)
    .sort((a, b) => b.count - a.count);
}

export function getWorkbenchUsageTotal(): number {
  return getWorkbenchUsageRows().reduce((sum, row) => sum + row.count, 0);
}
