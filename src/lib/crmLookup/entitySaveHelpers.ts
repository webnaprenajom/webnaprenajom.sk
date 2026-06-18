import { normalizeEmail } from "@/lib/crmLookup/normalizeIdentity";
import { adminDebugLog } from "@/lib/admin/adminDebugLog";
import { isCanonicalCustomerId, isValidEntityId } from "@/lib/crmLookup/entityIds";

export { isValidEntityId };

/** Phase 1 — delivery save guard when customer_id is still missing after resolve. */
export const DELIVERY_CUSTOMER_REQUIRED_MSG =
  "Dodávka musí mať priradeného klienta — vyberte klienta v lookup alebo zadajte platný e-mail.";

export const DELIVERY_CUSTOMER_AMBIGUOUS_MSG =
  "Klienta sa nepodarilo jednoznačne vytvoriť alebo priradiť. Vyberte existujúceho klienta manuálne.";

function warningsIndicateBlockedCreate(warnings: string[] | undefined): boolean {
  if (!warnings?.length) return false;
  return warnings.some((warning) => {
    const lower = warning.toLowerCase();
    return (
      lower.includes("blocked") ||
      lower.includes("ambiguous") ||
      lower.includes("nejednoznač") ||
      lower.includes("vyberte klienta manuálne")
    );
  });
}

/** Pure guard after resolveFormCustomerLink / resolveCustomerLinkFields — no Supabase. */
export function assertDeliveryHasCanonicalCustomer(linked: {
  customer_id?: string | null;
  customer_email?: string | null;
  warnings?: string[];
}): { ok: true } | { ok: false; message: string } {
  if (isCanonicalCustomerId(linked.customer_id)) {
    return { ok: true };
  }

  const emailCheck = validateFormEmail(linked.customer_email);
  const hasValidEmail = emailCheck.valid && !!emailCheck.normalized;

  if (warningsIndicateBlockedCreate(linked.warnings)) {
    return { ok: false, message: DELIVERY_CUSTOMER_AMBIGUOUS_MSG };
  }

  if (hasValidEmail) {
    return { ok: true };
  }

  return { ok: false, message: DELIVERY_CUSTOMER_REQUIRED_MSG };
}

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
  | { ok: true; id: T; error?: never; code?: never }
  | { ok: false; id?: never; error: string; code?: string };

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

