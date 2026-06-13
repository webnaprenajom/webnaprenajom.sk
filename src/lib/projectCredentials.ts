/**
 * Multi-row access credentials for project_notes (Batch RC4).
 */

import type { ProjectNote } from "@/components/admin/projectNotes/shared";
import type { Json } from "@/integrations/supabase/types";

export type AccessCredential = {
  id: string;
  label: string;
  url?: string;
  login?: string;
  password?: string;
  note?: string;
};

export function newCredentialId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `cred-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptyCredential(label = "Nový prístup"): AccessCredential {
  return { id: newCredentialId(), label, url: "", login: "", password: "", note: "" };
}

function trimOrEmpty(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function parseAccessCredentials(raw: unknown): AccessCredential[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const label = trimOrEmpty(o.label) || "Prístup";
      return {
        id: trimOrEmpty(o.id) || newCredentialId(),
        label,
        url: trimOrEmpty(o.url),
        login: trimOrEmpty(o.login),
        password: trimOrEmpty(o.password),
        note: trimOrEmpty(o.note),
      } satisfies AccessCredential;
    })
    .filter(Boolean) as AccessCredential[];
}

/** Build credentials from legacy single-row columns when JSON is empty. */
export function credentialsFromLegacyFields(
  item: Pick<ProjectNote, "url" | "username" | "password">,
): AccessCredential[] {
  const url = trimOrEmpty(item.url);
  const login = trimOrEmpty(item.username);
  const password = trimOrEmpty(item.password);
  if (!url && !login && !password) return [];
  return [
    {
      id: newCredentialId(),
      label: "Hlavný prístup",
      url,
      login,
      password,
    },
  ];
}

export function resolveProjectCredentials(
  item: Pick<ProjectNote, "url" | "username" | "password" | "access_credentials">,
): AccessCredential[] {
  const parsed = parseAccessCredentials(item.access_credentials);
  if (parsed.length > 0) return parsed;
  return credentialsFromLegacyFields(item);
}

export function hasAnyCredentials(
  item: Pick<ProjectNote, "url" | "username" | "password" | "access_credentials">,
): boolean {
  return resolveProjectCredentials(item).some(
    (c) => !!(c.url?.trim() || c.login?.trim() || c.password?.trim()),
  );
}

/** Keep legacy columns in sync with first credential for backward compatibility. */
export function syncLegacyCredentialColumns(credentials: AccessCredential[]): {
  url: string | null;
  username: string | null;
  password: string | null;
  access_credentials: AccessCredential[];
} {
  const cleaned = credentials
    .map((c) => ({
      ...c,
      label: c.label.trim() || "Prístup",
      url: c.url?.trim() || "",
      login: c.login?.trim() || "",
      password: c.password?.trim() || "",
      note: c.note?.trim() || "",
    }))
    .filter((c) => c.url || c.login || c.password || c.label !== "Prístup" || c.note);

  const first = cleaned[0];
  return {
    url: first?.url || null,
    username: first?.login || null,
    password: first?.password || null,
    access_credentials: cleaned,
  };
}

export function credentialsForSave(
  editing: Partial<Pick<ProjectNote, "url" | "username" | "password" | "access_credentials">>,
  credentials: AccessCredential[],
): Pick<ProjectNote, "url" | "username" | "password" | "access_credentials"> {
  const synced = syncLegacyCredentialColumns(credentials);
  return {
    url: synced.url,
    username: synced.username,
    password: synced.password,
    access_credentials: synced.access_credentials as Json,
  };
}
