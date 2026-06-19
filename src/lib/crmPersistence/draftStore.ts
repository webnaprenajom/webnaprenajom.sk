import { crmStorageGet, crmStorageRemove, crmStorageSet, crmStoragePruneMatching } from "./storage";

export interface CrmDraftMeta {
  route: string;
  modalId: string;
  entityId: string | "new";
  updatedAt: number;
  dirty: boolean;
}

export interface CrmDraftRecord<T = unknown> {
  meta: CrmDraftMeta;
  data: T;
}

/** Default TTL — stale drafts auto-pruned on read/write. */
export const CRM_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function buildDraftKey(modalId: string, entityId: string | "new"): string {
  return `draft:${modalId}:${entityId}`;
}

export function saveCrmDraft<T>(key: string, record: CrmDraftRecord<T>): void {
  pruneStaleCrmDrafts();
  crmStorageSet(key, JSON.stringify(record));
}

export function loadCrmDraft<T>(key: string): CrmDraftRecord<T> | null {
  const raw = crmStorageGet(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CrmDraftRecord<T>;
    if (!parsed?.meta?.updatedAt) return null;
    if (Date.now() - parsed.meta.updatedAt > CRM_DRAFT_TTL_MS) {
      crmStorageRemove(key);
      return null;
    }
    return parsed;
  } catch {
    crmStorageRemove(key);
    return null;
  }
}

export function clearCrmDraft(key: string): void {
  crmStorageRemove(key);
}

export function pruneStaleCrmDrafts(now = Date.now()): number {
  return crmStoragePruneMatching((bare) => {
    if (!bare.startsWith("draft:")) return false;
    const raw = crmStorageGet(bare);
    if (!raw) return true;
    try {
      const parsed = JSON.parse(raw) as CrmDraftRecord;
      return now - (parsed.meta?.updatedAt ?? 0) > CRM_DRAFT_TTL_MS;
    } catch {
      return true;
    }
  });
}
