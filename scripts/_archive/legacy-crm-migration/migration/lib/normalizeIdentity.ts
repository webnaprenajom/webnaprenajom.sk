/**
 * Migration identity normalization — extends shared CRM helpers with phone rules.
 */

export {
  collapseWhitespace,
  normalizeEmail,
  normalizeClientName,
  clientNameCompareKey,
  clientNamesMatch,
} from "../../../src/lib/crmLookup/normalizeIdentity.js";

import {
  normalizeEmail,
  clientNameCompareKey,
} from "../../../src/lib/crmLookup/normalizeIdentity.js";

/** Digits-only phone key for conservative exact matching. */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return digits;
}

/** Composite key for normalized name + email (matching priority 3). */
export function buildNameEmailKey(
  name: string | null | undefined,
  email: string | null | undefined,
): string | null {
  const e = normalizeEmail(email);
  const n = clientNameCompareKey(name);
  if (!e || !n) return null;
  return `${n}|${e}`;
}
