/**
 * Email thread resolution — Deno (Batch G / G.5).
 * Matching order documented in scripts/INBOUND_EMAIL.md § Thread resolution.
 */

export function normalizeEmailSubject(subject: string | null | undefined): string {
  if (!subject?.trim()) return ''
  return subject
    .trim()
    .replace(/^(re|fwd|fw|odp|odpoveď):\s*/gi, '')
    .replace(/^(re|fwd|fw|odp|odpoveď):\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function normalizeMessageId(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  return value.trim().replace(/^<|>$/g, '').toLowerCase()
}

/** Parse References / In-Reply-To style space-separated message-id tokens. */
export function parseReferencesHeader(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return []
  const matches = raw.match(/<[^>]+>|[^\s,;]+@[^\s,;>]+/g) ?? []
  const ids = matches
    .map((m) => normalizeMessageId(m))
    .filter((id): id is string => !!id)
  return [...new Set(ids)]
}

export function subjectThreadKey(normalizedSubject: string, email: string): string | null {
  if (!normalizedSubject || !email) return null
  return `subject:${normalizedSubject}:${email.toLowerCase()}`
}

export function buildOutboundThreadId(
  resendId: string | null | undefined,
  normalizedSubject: string,
  recipientEmail: string | null,
): string | null {
  if (resendId) return `resend:${resendId}`
  if (normalizedSubject && recipientEmail) {
    return subjectThreadKey(normalizedSubject, recipientEmail)
  }
  return null
}

/** Ordered candidate message ids for DB lookup (highest priority first). */
export function threadLookupCandidates(
  inReplyTo: string | null | undefined,
  referencesRaw: string | null | undefined,
  messageId: string | null | undefined,
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (id: string | null | undefined) => {
    const n = normalizeMessageId(id)
    if (n && !seen.has(n)) {
      seen.add(n)
      out.push(n)
    }
  }
  push(inReplyTo)
  for (const ref of parseReferencesHeader(referencesRaw)) push(ref)
  push(messageId)
  return out
}
