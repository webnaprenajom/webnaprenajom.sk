/**
 * Inbound email parsing, threading & ops — Deno (Batch G / G.5).
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  buildOutboundThreadId,
  normalizeEmailSubject,
  normalizeMessageId,
  subjectThreadKey,
  threadLookupCandidates,
} from './threading.ts'

const PREVIEW_MAX = 240
const DEFAULT_OUTBOUND_FROM = 'info@webnaprenajom.sk'

/** Extract bare email from "Name <user@domain.com>" or plain address. */
export function parseEmailAddress(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const trimmed = raw.trim()
  const angle = trimmed.match(/<([^>]+)>/)
  const candidate = (angle?.[1] ?? trimmed).trim().toLowerCase()
  return candidate.includes('@') ? candidate : null
}

export function deriveThreadId(
  inReplyTo: string | null | undefined,
  messageId: string | null | undefined,
): string | null {
  const reply = normalizeMessageId(inReplyTo)
  if (reply) return reply
  return normalizeMessageId(messageId)
}

export function stripHtmlToText(html: string | null | undefined): string | null {
  if (!html?.trim()) return null
  const stripped = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
  return stripped.replace(/\s+/g, ' ').trim() || null
}

export function buildInboundPreview(
  text: string | null | undefined,
  html: string | null | undefined,
  maxLen = PREVIEW_MAX,
): string | null {
  const fromText = text?.trim() || stripHtmlToText(html)
  if (!fromText?.trim()) return null
  const collapsed = fromText.replace(/\s+/g, ' ').trim()
  if (collapsed.length <= maxLen) return collapsed
  return `${collapsed.slice(0, maxLen - 1)}…`
}

export interface ResendEmailReceivedWebhookData {
  email_id: string
  created_at?: string
  from: string
  to?: string[]
  cc?: string[]
  bcc?: string[]
  subject?: string
  message_id?: string
  attachments?: Array<{ id: string; filename?: string }>
}

export interface ResendReceivedEmailBody {
  id: string
  from: string
  to?: string[]
  subject?: string
  text?: string | null
  html?: string | null
  message_id?: string
  headers?: Record<string, string | string[]>
  attachments?: Array<{ id: string; filename?: string }>
}

export function headerValue(
  headers: Record<string, string | string[]> | undefined,
  name: string,
): string | null {
  if (!headers) return null
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase())
  if (!key) return null
  const val = headers[key]
  return Array.isArray(val) ? val[0] ?? null : val ?? null
}

export type WebhookIncidentType =
  | 'verify_failed'
  | 'fetch_failed'
  | 'malformed'
  | 'insert_failed'
  | 'deduped_inbound'

/** Safe operational incident log — no raw payloads or secrets. */
export async function logWebhookIncident(
  admin: SupabaseClient,
  input: {
    incident_type: WebhookIncidentType
    summary: string
    provider_email_id?: string | null
    sender_email?: string | null
    customer_email?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  try {
    const { error } = await admin.from('communication_webhook_incidents').insert({
      incident_type: input.incident_type,
      summary: input.summary.slice(0, 500),
      provider_email_id: input.provider_email_id ?? null,
      sender_email: input.sender_email ?? null,
      customer_email: input.customer_email ?? null,
      metadata: input.metadata ?? {},
      occurred_at: new Date().toISOString(),
    })
    if (error) console.error('[communication_ops] incident insert failed', error.message)
  } catch (e) {
    console.error('[communication_ops] incident error', e instanceof Error ? e.message : 'unknown')
  }
}

export async function resolveInboundCustomer(
  admin: SupabaseClient,
  senderEmail: string,
): Promise<{
  customer_id: string | null
  customer_email: string | null
  lead_id: string | null
}> {
  const email = parseEmailAddress(senderEmail)
  if (!email) return { customer_id: null, customer_email: null, lead_id: null }

  const { data: customer } = await admin
    .from('customers')
    .select('id,email')
    .eq('email', email)
    .maybeSingle()

  const { data: lead } = await admin
    .from('leads')
    .select('id')
    .ilike('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    customer_id: customer?.id ?? null,
    customer_email: customer?.email ?? email,
    lead_id: lead?.id ?? null,
  }
}

async function findThreadByMessageId(
  admin: SupabaseClient,
  messageId: string,
): Promise<string | null> {
  const { data } = await admin
    .from('communication_events')
    .select('thread_id,message_id')
    .eq('message_id', messageId)
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (data?.thread_id) return data.thread_id
  if (data?.message_id) return normalizeMessageId(data.message_id)
  return null
}

async function findThreadByResendId(
  admin: SupabaseClient,
  resendId: string,
): Promise<string | null> {
  const { data } = await admin
    .from('communication_events')
    .select('thread_id')
    .eq('kind', 'email_out')
    .eq('thread_id', `resend:${resendId}`)
    .maybeSingle()
  if (data?.thread_id) return data.thread_id

  const { data: metaRow } = await admin
    .from('communication_events')
    .select('thread_id')
    .eq('kind', 'email_out')
    .filter('metadata->>resend_id', 'eq', resendId)
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return metaRow?.thread_id ?? `resend:${resendId}`
}

async function findThreadBySubjectFallback(
  admin: SupabaseClient,
  senderEmail: string,
  subject: string,
): Promise<{ threadId: string | null; match: string | null }> {
  const normalized = normalizeEmailSubject(subject)
  if (!normalized) return { threadId: null, match: null }

  const key = subjectThreadKey(normalized, senderEmail)
  if (key) {
    const { data } = await admin
      .from('communication_events')
      .select('thread_id')
      .eq('thread_id', key)
      .maybeSingle()
    if (data?.thread_id) return { threadId: data.thread_id, match: 'subject' }
  }

  const { data: rows } = await admin
    .from('communication_events')
    .select('thread_id,metadata,customer_email,sender_email,recipient_email')
    .in('kind', ['email_out', 'email_in'])
    .or(
      `recipient_email.eq.${senderEmail},sender_email.eq.${senderEmail},customer_email.eq.${senderEmail}`,
    )
    .order('occurred_at', { ascending: false })
    .limit(30)

  for (const row of rows ?? []) {
    const meta = row.metadata as Record<string, unknown> | null
    const rowSubject =
      typeof meta?.normalized_subject === 'string' ? meta.normalized_subject : null
    if (rowSubject === normalized && row.thread_id) {
      return { threadId: row.thread_id, match: 'subject' }
    }
  }

  if (key) return { threadId: key, match: 'subject_new' }
  return { threadId: null, match: null }
}

export async function resolveThreadIdFromExisting(
  admin: SupabaseClient,
  input: {
    inReplyTo: string | null
    referencesRaw: string | null
    messageId: string | null
    senderEmail: string
    subject: string
  },
): Promise<{ threadId: string | null; threadMatch: string | null }> {
  const candidates = threadLookupCandidates(
    input.inReplyTo,
    input.referencesRaw,
    input.messageId,
  )

  for (const cid of candidates) {
    const byMsg = await findThreadByMessageId(admin, cid)
    if (byMsg) {
      return { threadId: byMsg, threadMatch: input.inReplyTo === cid ? 'in_reply_to' : 'references' }
    }
    const byResend = await findThreadByResendId(admin, cid)
    if (byResend) {
      return { threadId: byResend, threadMatch: 'resend_outbound' }
    }
  }

  const subjectResult = await findThreadBySubjectFallback(
    admin,
    input.senderEmail,
    input.subject,
  )
  if (subjectResult.threadId) {
    return { threadId: subjectResult.threadId, threadMatch: subjectResult.match }
  }

  const root = normalizeMessageId(input.messageId)
  if (root) return { threadId: root, threadMatch: 'new_root' }

  return { threadId: null, threadMatch: null }
}

export interface LogInboundEmailInput {
  provider_email_id: string
  svix_id?: string | null
  sender_email: string
  recipient_email: string | null
  subject: string
  body_preview: string | null
  message_id: string | null
  in_reply_to: string | null
  thread_id: string | null
  thread_match?: string | null
  customer_id: string | null
  customer_email: string | null
  lead_id: string | null
  occurred_at: string
  attachment_count?: number
}

export async function logInboundEmailEvent(
  admin: SupabaseClient,
  input: LogInboundEmailInput,
): Promise<{ ok: boolean; id?: string; deduped?: boolean; error?: string }> {
  try {
    const normalizedSubject = normalizeEmailSubject(input.subject)
    const metadata = {
      origin: 'inbound_webhook',
      provider: 'resend',
      provider_email_id: input.provider_email_id,
      svix_id: input.svix_id ?? null,
      attachment_count: input.attachment_count ?? 0,
      normalized_subject: normalizedSubject || null,
      thread_match: input.thread_match ?? null,
    }

    const { data, error } = await admin
      .from('communication_events')
      .insert({
        kind: 'email_in',
        title: input.subject.trim() || '(bez predmetu)',
        body_preview: input.body_preview,
        customer_id: input.customer_id,
        customer_email: input.customer_email,
        sender_email: input.sender_email,
        recipient_email: input.recipient_email,
        message_id: input.message_id,
        in_reply_to: input.in_reply_to,
        thread_id: input.thread_id,
        metadata,
        source_table: input.lead_id ? 'leads' : null,
        source_id: input.lead_id,
        occurred_at: input.occurred_at,
      })
      .select('id')
      .maybeSingle()

    if (error) {
      if (error.code === '23505') {
        console.info('[communication_events] deduped inbound', {
          provider_email_id: input.provider_email_id,
        })
        await logWebhookIncident(admin, {
          incident_type: 'deduped_inbound',
          summary: 'Duplicate inbound webhook suppressed',
          provider_email_id: input.provider_email_id,
          sender_email: input.sender_email,
          customer_email: input.customer_email,
        })
        return { ok: true, deduped: true }
      }
      console.error('[communication_events] inbound insert failed', error.message)
      return { ok: false, error: error.message }
    }

    return { ok: true, id: data?.id }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    console.error('[communication_events] logInboundEmailEvent error', msg)
    return { ok: false, error: msg }
  }
}

export async function fetchResendReceivedEmail(
  apiKey: string,
  emailId: string,
): Promise<{ ok: true; email: ResendReceivedEmailBody } | { ok: false; error: string }> {
  try {
    const resp = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const body = await resp.json()
    if (!resp.ok) {
      const msg = typeof body?.message === 'string' ? body.message : `HTTP ${resp.status}`
      return { ok: false, error: msg }
    }
    return { ok: true, email: body as ResendReceivedEmailBody }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'fetch failed' }
  }
}

export { DEFAULT_OUTBOUND_FROM, buildOutboundThreadId, normalizeEmailSubject }
