/**
 * Unified client identity merge — one customer across rentals, projects, hosting (Batch RC4).
 */

import { normalizeEmail, normalizeClientName, clientNameCompareKey } from "./normalizeIdentity";
import { isCanonicalCustomerId } from "./entityIds";

export type ClientSection = "project" | "hosting" | "rental" | "lead";

export type UnifiedClientEntry = {
  /** Canonical customer UUID when known. */
  customerId: string | null;
  displayName: string;
  email: string | null;
  /** Normalized name key for rental-only matches. */
  nameKey: string | null;
  sections: Set<ClientSection>;
  projectCount: number;
  hostingCount: number;
  rentalCount: number;
  leadCount: number;
};

export type UnifiedClientSeed = {
  customerId?: string | null;
  displayName: string;
  email?: string | null;
  section: ClientSection;
};

function identityKeys(seed: UnifiedClientSeed): string[] {
  const keys: string[] = [];
  if (seed.customerId && isCanonicalCustomerId(seed.customerId)) {
    keys.push(`id:${seed.customerId}`);
  }
  const email = normalizeEmail(seed.email);
  if (email) keys.push(`email:${email}`);
  const nameKey = clientNameCompareKey(seed.displayName);
  if (nameKey) keys.push(`name:${nameKey}`);
  return keys;
}

/** Merge client seeds by strongest identity: customer_id → email → name. */
export function mergeUnifiedClientSeeds(seeds: UnifiedClientSeed[]): UnifiedClientEntry[] {
  const byKey = new Map<string, UnifiedClientEntry>();
  const keyToPrimary = new Map<string, string>();

  const ensure = (primaryKey: string, seed: UnifiedClientSeed): UnifiedClientEntry => {
    let entry = byKey.get(primaryKey);
    if (!entry) {
      entry = {
        customerId:
          seed.customerId && isCanonicalCustomerId(seed.customerId) ? seed.customerId : null,
        displayName: normalizeClientName(seed.displayName) || seed.displayName.trim(),
        email: normalizeEmail(seed.email),
        nameKey: clientNameCompareKey(seed.displayName),
        sections: new Set(),
        projectCount: 0,
        hostingCount: 0,
        rentalCount: 0,
        leadCount: 0,
      };
      byKey.set(primaryKey, entry);
    } else {
      if (!entry.customerId && seed.customerId && isCanonicalCustomerId(seed.customerId)) {
        entry.customerId = seed.customerId;
      }
      if (!entry.email && seed.email) entry.email = normalizeEmail(seed.email);
      if (entry.displayName.length < seed.displayName.trim().length) {
        entry.displayName = seed.displayName.trim();
      }
    }
    return entry;
  };

  for (const seed of seeds) {
    const keys = identityKeys(seed);
    if (keys.length === 0) continue;

    let primaryKey = keys.find((k) => keyToPrimary.has(k))
      ? keyToPrimary.get(keys.find((k) => keyToPrimary.has(k))!)!
      : keys[0];

    if (!byKey.has(primaryKey)) {
      ensure(primaryKey, seed);
    }

    for (const k of keys) {
      const existing = keyToPrimary.get(k);
      if (existing && existing !== primaryKey) {
        const merged = byKey.get(primaryKey)!;
        const other = byKey.get(existing)!;
        merged.sections = new Set([...merged.sections, ...other.sections]);
        merged.projectCount += other.projectCount;
        merged.hostingCount += other.hostingCount;
        merged.rentalCount += other.rentalCount;
        merged.leadCount += other.leadCount;
        if (!merged.customerId && other.customerId) merged.customerId = other.customerId;
        if (!merged.email && other.email) merged.email = other.email;
        byKey.delete(existing);
        for (const [kk, pk] of keyToPrimary.entries()) {
          if (pk === existing) keyToPrimary.set(kk, primaryKey);
        }
      }
      keyToPrimary.set(k, primaryKey);
    }

    const entry = ensure(primaryKey, seed);
    entry.sections.add(seed.section);
    switch (seed.section) {
      case "project":
        entry.projectCount += 1;
        break;
      case "hosting":
        entry.hostingCount += 1;
        break;
      case "rental":
        entry.rentalCount += 1;
        break;
      case "lead":
        entry.leadCount += 1;
        break;
    }
  }

  return [...byKey.values()].sort((a, b) => a.displayName.localeCompare(b.displayName, "sk"));
}

export function unifiedClientSectionSummary(entry: UnifiedClientEntry): string {
  const parts: string[] = [];
  if (entry.projectCount) parts.push(`${entry.projectCount} proj.`);
  if (entry.hostingCount) parts.push(`${entry.hostingCount} host.`);
  if (entry.rentalCount) parts.push(`${entry.rentalCount} pren.`);
  if (entry.leadCount) parts.push(`${entry.leadCount} lead`);
  return parts.join(" · ") || "—";
}
