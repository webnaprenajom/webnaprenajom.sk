/** ponytail: in-memory fallback when localStorage throws (sandbox iframe, private mode). */
const memory = new Map<string, string>();

const PREFIX = "crm:";

export function crmStorageAvailable(): boolean {
  try {
    const probe = `${PREFIX}__probe__`;
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function crmStorageGet(key: string): string | null {
  const full = PREFIX + key;
  try {
    const v = localStorage.getItem(full);
    if (v !== null) return v;
  } catch {
    /* fall through */
  }
  return memory.get(full) ?? null;
}

export function crmStorageSet(key: string, value: string): void {
  const full = PREFIX + key;
  try {
    localStorage.setItem(full, value);
    memory.set(full, value);
    return;
  } catch {
    memory.set(full, value);
  }
}

export function crmStorageRemove(key: string): void {
  const full = PREFIX + key;
  try {
    localStorage.removeItem(full);
  } catch {
    /* ignore */
  }
  memory.delete(full);
}

/** Remove all crm-prefixed keys (draft + view restore). */
export function crmStoragePruneMatching(predicate: (key: string) => boolean): number {
  let removed = 0;
  if (crmStorageAvailable()) {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (!k?.startsWith(PREFIX)) continue;
        const bare = k.slice(PREFIX.length);
        if (predicate(bare)) {
          localStorage.removeItem(k);
          memory.delete(k);
          removed++;
        }
      }
    } catch {
      /* ignore */
    }
  }
  for (const k of [...memory.keys()]) {
    if (!k.startsWith(PREFIX)) continue;
    const bare = k.slice(PREFIX.length);
    if (predicate(bare)) {
      memory.delete(k);
      removed++;
    }
  }
  return removed;
}
