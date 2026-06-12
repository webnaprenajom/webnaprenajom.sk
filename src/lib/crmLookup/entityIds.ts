const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCanonicalCustomerId(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  return UUID_RE.test(value.trim());
}

/** Alias for route/detail guards (Batch RC3). */
export function isValidEntityId(value: string | null | undefined): boolean {
  return isCanonicalCustomerId(value);
}
