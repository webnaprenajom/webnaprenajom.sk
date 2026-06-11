/**
 * Batch G / G.5: Resend inbound email webhook → communication_events (kind=email_in).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Webhook } from 'https://esm.sh/svix@1.38.0'
import {
  buildInboundPreview,
  fetchResendReceivedEmail,
  headerValue,
  logInboundEmailEvent,
  logWebhookIncident,
  parseEmailAddress,
  normalizeMessageId,
  resolveInboundCustomer,
  resolveThreadIdFromExisting,
  type ResendEmailReceivedWebhookData,
} from '../_shared/inboundEmail.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
}

interface VerifiedWebhookEvent {
  type: string
  created_at?: string
  data?: ResendEmailReceivedWebhookData
}

function verifyResendWebhook(req: Request, rawBody: string): VerifiedWebhookEvent {
  const secret = Deno.env.get('RESEND_WEBHOOK_SECRET')
  if (!secret) throw new Error('RESEND_WEBHOOK_SECRET not configured')

  const svixId = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')
  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new Error('Missing Svix headers')
  }

  const wh = new Webhook(secret)
  return wh.verify(rawBody, {
    'svix-id': svixId,
    'svix-timestamp': svixTimestamp,
    'svix-signature': svixSignature,
  }) as VerifiedWebhookEvent
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const rawBody = await req.text()

  let event: VerifiedWebhookEvent
  try {
    event = verifyResendWebhook(req, rawBody)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'verification failed'
    console.warn('[inbound-email-webhook] signature rejected', msg)
    await logWebhookIncident(admin, {
      incident_type: 'verify_failed',
      summary: msg.slice(0, 200),
    })
    return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (event.type !== 'email.received') {
    return new Response(JSON.stringify({ ok: true, skipped: true, type: event.type }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const webhookData = event.data
  if (!webhookData?.email_id || !webhookData.from) {
    console.warn('[inbound-email-webhook] malformed payload', {
      has_email_id: !!webhookData?.email_id,
      has_from: !!webhookData?.from,
    })
    await logWebhookIncident(admin, {
      incident_type: 'malformed',
      summary: 'Missing email_id or from in email.received payload',
      provider_email_id: webhookData?.email_id ?? null,
    })
    return new Response(JSON.stringify({ error: 'Malformed email.received payload' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    console.error('[inbound-email-webhook] RESEND_API_KEY not configured')
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const senderEmail = parseEmailAddress(webhookData.from)
  if (!senderEmail) {
    await logWebhookIncident(admin, {
      incident_type: 'malformed',
      summary: 'Could not parse sender address',
      provider_email_id: webhookData.email_id,
    })
    return new Response(JSON.stringify({ error: 'Invalid sender address' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const recipientEmail =
    parseEmailAddress(webhookData.to?.[0]) ??
    parseEmailAddress(webhookData.to?.join(','))

  const fetched = await fetchResendReceivedEmail(resendApiKey, webhookData.email_id)
  if (!fetched.ok) {
    console.error('[inbound-email-webhook] receiving.get failed', {
      email_id: webhookData.email_id,
      error: fetched.error,
    })
    await logWebhookIncident(admin, {
      incident_type: 'fetch_failed',
      summary: fetched.error.slice(0, 200),
      provider_email_id: webhookData.email_id,
      sender_email: senderEmail,
    })
    return new Response(
      JSON.stringify({ ok: false, error: 'Failed to fetch email body', logged: false }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const full = fetched.email
  const inReplyToRaw =
    headerValue(full.headers, 'in-reply-to') ??
    headerValue(full.headers, 'In-Reply-To')
  const referencesRaw =
    headerValue(full.headers, 'references') ??
    headerValue(full.headers, 'References')
  const messageId = normalizeMessageId(full.message_id ?? webhookData.message_id)
  const inReplyTo = normalizeMessageId(inReplyToRaw)
  const subject = (full.subject ?? webhookData.subject ?? '').trim() || '(bez predmetu)'

  const threadResult = await resolveThreadIdFromExisting(admin, {
    inReplyTo,
    referencesRaw,
    messageId,
    senderEmail,
    subject,
  })

  const resolved = await resolveInboundCustomer(admin, senderEmail)
  const preview = buildInboundPreview(full.text, full.html)
  const occurredAt =
    webhookData.created_at ?? full.created_at ?? event.created_at ?? new Date().toISOString()

  const logResult = await logInboundEmailEvent(admin, {
    provider_email_id: webhookData.email_id,
    svix_id: req.headers.get('svix-id'),
    sender_email: senderEmail,
    recipient_email: recipientEmail,
    subject,
    body_preview: preview,
    message_id: messageId,
    in_reply_to: inReplyTo,
    thread_id: threadResult.threadId,
    thread_match: threadResult.threadMatch,
    customer_id: resolved.customer_id,
    customer_email: resolved.customer_email ?? senderEmail,
    lead_id: resolved.lead_id,
    occurred_at: occurredAt,
    attachment_count: full.attachments?.length ?? webhookData.attachments?.length ?? 0,
  })

  if (!logResult.ok && !logResult.deduped) {
    console.error('[inbound-email-webhook] log failed', logResult.error)
    await logWebhookIncident(admin, {
      incident_type: 'insert_failed',
      summary: (logResult.error ?? 'insert failed').slice(0, 200),
      provider_email_id: webhookData.email_id,
      sender_email: senderEmail,
      customer_email: resolved.customer_email,
    })
    return new Response(JSON.stringify({ ok: false, error: logResult.error }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.info('[inbound-email-webhook] processed', {
    email_id: webhookData.email_id,
    sender: senderEmail,
    customer_id: resolved.customer_id,
    deduped: logResult.deduped ?? false,
    thread_id: threadResult.threadId,
    thread_match: threadResult.threadMatch,
  })

  return new Response(
    JSON.stringify({
      ok: true,
      id: logResult.id,
      deduped: logResult.deduped ?? false,
      customer_resolved: !!resolved.customer_id,
      thread_match: threadResult.threadMatch,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
