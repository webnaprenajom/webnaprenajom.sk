import type { CustomerCredentialBrief } from "./types";

/** Project ids with linked rows in customer_credentials (canonical credential source). */
export function projectIdsWithCanonicalCredentials(
  credentials: Pick<CustomerCredentialBrief, "linked_entity_type" | "linked_entity_id">[],
): Set<string> {
  const ids = new Set<string>();
  for (const row of credentials) {
    if (row.linked_entity_type === "project" && row.linked_entity_id) {
      ids.add(row.linked_entity_id);
    }
  }
  return ids;
}

export function annotateNotesWithCanonicalCredentialFlags<
  T extends { id: string; has_credentials: boolean },
>(notes: T[], credentials: Pick<CustomerCredentialBrief, "linked_entity_type" | "linked_entity_id">[]): T[] {
  const linkedProjectIds = projectIdsWithCanonicalCredentials(credentials);
  return notes.map((note) => ({
    ...note,
    has_credentials: linkedProjectIds.has(note.id),
  }));
}
