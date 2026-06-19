/** ponytail: naive substring match — fine for page-level client-side filter over loaded rows. */
export function matchesSearchQuery(
  query: string,
  ...parts: (string | null | undefined)[]
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return parts.some((p) => p && p.toLowerCase().includes(q));
}
