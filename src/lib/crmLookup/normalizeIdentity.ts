/** Normalize email / client name for lookup, linking, and deduplication. */

/** Collapse internal whitespace to single spaces. */
export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email?.trim()) return null;
  const e = collapseWhitespace(email).toLowerCase();
  return e.includes("@") ? e : null;
}

/** Display-safe client name — trimmed, collapsed whitespace. */
export function normalizeClientName(name: string | null | undefined): string | null {
  if (!name?.trim()) return null;
  return collapseWhitespace(name);
}

/** Case-insensitive comparison key for client names. */
export function clientNameCompareKey(name: string | null | undefined): string | null {
  const normalized = normalizeClientName(name);
  return normalized ? normalized.toLowerCase() : null;
}

export function clientNamesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ka = clientNameCompareKey(a);
  const kb = clientNameCompareKey(b);
  return !!ka && ka === kb;
}

export function lookupQueryTokens(query: string): string {
  return collapseWhitespace(query).toLowerCase();
}
