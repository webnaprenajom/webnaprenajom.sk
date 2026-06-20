/**
 * Tier-3 hub matching uses lead display names — only when no canonical customer id or email.
 */
export function allowClientNameHubFallback(
  customerId: string | null,
  resolvedEmail: string,
): boolean {
  return !customerId && !resolvedEmail.trim();
}
