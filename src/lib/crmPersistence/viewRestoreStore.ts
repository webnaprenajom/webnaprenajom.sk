import { crmStorageGet, crmStorageRemove, crmStorageSet } from "./storage";
import { CRM_DRAFT_TTL_MS } from "./draftStore";

export interface CrmViewRestoreState {
  route: string;
  modalId?: string;
  entityId?: string;
  section?: string;
  query?: Record<string, string>;
  updatedAt: number;
}

const VIEW_KEY = "view:last";

export function saveCrmViewState(state: Omit<CrmViewRestoreState, "updatedAt">): void {
  const record: CrmViewRestoreState = { ...state, updatedAt: Date.now() };
  crmStorageSet(VIEW_KEY, JSON.stringify(record));
}

export function loadCrmViewState(): CrmViewRestoreState | null {
  const raw = crmStorageGet(VIEW_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CrmViewRestoreState;
    if (!parsed?.route || !parsed.updatedAt) return null;
    if (Date.now() - parsed.updatedAt > CRM_DRAFT_TTL_MS) {
      crmStorageRemove(VIEW_KEY);
      return null;
    }
    return parsed;
  } catch {
    crmStorageRemove(VIEW_KEY);
    return null;
  }
}

export function clearCrmViewState(): void {
  crmStorageRemove(VIEW_KEY);
}
