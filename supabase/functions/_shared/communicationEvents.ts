/**
 * Communication events — Deno edge function helpers (Batch F2 / F2.5 / G.5).
 * Best-effort logging: never throw; email send must succeed independently.
 * Uses service-role client — server-only; never import from browser code.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  buildOutboundThreadId,
  normalizeEmailSubject,
} from './threading.ts'

const PREVIEW_MAX = 240
const DEFAULT_OUTBOUND_FROM = 'info@webnaprenajom.sk'

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email?.trim()) return null
  const e = email.trim().toLowerCase()
  return e.includes('@') ? e : null
}

export function buildEventPreview(text: string | null | undefined, maxLen = PREVIEW_MAX): string | null {
  if (!text?.trim()) return null
  const collapsed = text.replace(/\s+/g, ' ').trim()
  if (collapsed.length <= maxLen) return collapsed
  return `${collapsed.slice(0, maxLen - 1)}…`
}

export async function resolveCommunicationCustomer(
  admin: SupabaseClient,
  input: { customer_id?: string | null; customer_email?: string | null },
): Promise<{ customer_id: string | null; customer_email: string | null }> {
  const email = normalizeEmail(input.customer_email)

  if (input.customer_id) {
    const { data } = await admin
      .from('customers')
      .select('id,email')
      .eq('id', input.customer_id)
      .maybeSingle()
    if (data) {
      return { customer_id: data.id, customer_email: normalizeEmail(data.email) ?? email }
    }
    return { customer_id: input.customer_id, customer_email: email }
  }

  if (email) {
    const { data } = await admin.from('customers').select('id,email').eq('email', email).maybeSingle()
    if (data) return { customer_id: data.id, customer_email: email }
    return { customer_id: null, customer_email: email }
  }

  return { customer_id: null, customer_email: null }
}

export interface LogEmailOutInput {
  customer_email: string
  customer_id?: string | null
  title: string
  subject?: string
  body_text?: string | null
  resend_id?: string | null
  edge_function: string
  source_table?: string | null
  source_id?: string | null
  metadata?: Record<string, unknown>
}

/** Best-effort insert after successful Resend send. */
export async function logEmailOutEvent(
  admin: SupabaseClient,
  input: LogEmailOutInput,
): Promise<{ ok: boolean; deduped?: boolean; error?: string }> {
  try {
    const resolved = await resolveCommunicationCustomer(admin, {
      customer_id: input.customer_id,
      customer_email: input.customer_email,
    })

    const subject = input.subject ?? input.title
    const normalizedSubject = normalizeEmailSubject(subject)
    const threadId = buildOutboundThreadId(
      input.resend_id ?? null,
      normalizedSubject,
      resolved.customer_email,
    )

    const metadata = {
      origin: 'edge_function',
      edge_function: input.edge_function,
      subject,
      resend_id: input.resend_id ?? null,
      normalized_subject: normalizedSubject || null,
      outbound_thread_key: threadId,
      ...input.metadata,
    }

    const { error } = await admin.from('communication_events').insert({
      kind: 'email_out',
      title: input.title,
      body_preview: buildEventPreview(input.body_text ?? subject ?? input.title),
      customer_id: resolved.customer_id,
      customer_email: resolved.customer_email,
      sender_email: DEFAULT_OUTBOUND_FROM,
      recipient_email: resolved.customer_email,
      thread_id: threadId,
      metadata,
      source_table: input.source_table ?? null,
      source_id: input.source_id ?? null,
      occurred_at: new Date().toISOString(),
    })

    if (error) {
      if (error.code === '23505') {
        console.info('[communication_events] deduped email_out', {
          resend_id: input.resend_id ?? null,
          edge_function: input.edge_function,
        })
        return { ok: true, deduped: true }
      }
      console.error('[communication_events] insert failed', error.message)
      return { ok: false, error: error.message }
    }

    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    console.error('[communication_events] logEmailOutEvent error', msg)
    return { ok: false, error: msg }
  }
}
