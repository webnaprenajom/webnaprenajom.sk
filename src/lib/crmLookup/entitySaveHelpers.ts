import { normalizeEmail } from "@/lib/crmLookup/normalizeIdentity";
import { adminDebugLog } from "@/lib/admin/adminDebugLog";
import { isValidEntityId } from "@/lib/crmLookup/entityIds";

export { isValidEntityId };

export function validateFormEmail(raw: string | null | undefined): {
  valid: boolean;
  normalized: string | null;
  error?: string;
} {
  const trimmed = raw?.trim() || "";
  if (!trimmed) return { valid: true, normalized: null };
  const normalized = normalizeEmail(trimmed);
  if (!normalized) {
    return {
      valid: false,
      normalized: null,
      error: "E-mail nie je v platnom formáte (napr. klient@firma.sk).",
    };
  }
  return { valid: true, normalized };
}

export type InsertRowResult<T extends string = string> =
  | { ok: true; id: T }
  | { ok: false; error: string; code?: string };

export function parseInsertRowId(
  data: { id?: string } | null | undefined,
  error: { message: string; code?: string } | null,
  entityLabel: string,
): InsertRowResult {
  if (error) {
    adminDebugLog("insert", `${entityLabel} failed`, { message: error.message, code: error.code });
    return { ok: false, error: error.message, code: error.code };
  }
  if (!data?.id) {
    const msg = `${entityLabel} sa nepodarilo overiť po uložení (chýba ID). Skontrolujte oprávnenia alebo obnovte zoznam.`;
    adminDebugLog("insert", `${entityLabel} missing id after insert`, {});
    return { ok: false, error: msg };
  }
  adminDebugLog("insert", `${entityLabel} saved`, { id: data.id });
  return { ok: true, id: data.id };
}

