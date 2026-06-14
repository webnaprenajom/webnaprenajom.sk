import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface LeadPayload {
  name: string
  email: string
  phone?: string
  message?: string
  type: 'ai' | 'consultation' | 'redesign' | 'order'
  language: string
  date?: string
  time?: string
  source?: string
}

const SOURCE_LABELS: Record<string, string> = {
  'hero-funnel': 'Hero kvíz',
  'ai-kalkulacka': 'AI kalkulačka',
  'lead-dialog-ai': 'Lead dialog – AI návrh',
  'lead-dialog-redesign': 'Lead dialog – Redizajn',
  'lead-dialog-consultation': 'Lead dialog – Konzultácia',
  'floating-cta': 'Plávajúce CTA',
  'mobile-bottom-bar': 'Mobilná spodná lišta',
  'sticky-header': 'Sticky header',
  'pricing-section': 'Cenník',
  'faq-section': 'FAQ',
  'strong-cta': 'Záverečné CTA',
}

function sourceLabel(src?: string) {
  if (!src) return 'Web (neidentifikované)'
  return SOURCE_LABELS[src] || src
}

function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate)
  return d.toLocaleDateString('sk-SK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
    timeZone: 'Europe/Prague',
  })
}

function buildEmailHtml(data: LeadPayload): string {
  const isConsultation = data.type === 'consultation'
  const typeSk =
    data.type === 'consultation' ? 'Konzultácia' :
    data.type === 'redesign' ? 'Redizajn webu' :
    data.type === 'order' ? 'Objednávka balíka' :
    'AI Návrh webu'

  const now = new Date()
  const submittedAt = now.toLocaleString('sk-SK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Prague',
  })

  const rows: { label: string; value: string }[] = [
    { label: 'Zdroj formulára', value: sourceLabel(data.source) },
    { label: 'Typ dopytu', value: typeSk },
    { label: 'Meno', value: data.name },
    { label: 'E-mail', value: data.email },
  ]

  if (data.phone) rows.push({ label: 'Telefón', value: data.phone })
  if (data.message) rows.push({ label: 'Správa', value: data.message })
  if (isConsultation && data.date) rows.push({ label: 'Dátum konzultácie', value: formatDate(data.date) })
  if (isConsultation && data.time) rows.push({ label: 'Čas konzultácie', value: data.time })
  rows.push({ label: 'Jazyk webu', value: data.language.toUpperCase() })
  rows.push({ label: 'Odoslané', value: submittedAt })

  const rowsHtml = rows
    .map(
      (r) => `
      <tr>
        <td style="padding: 12px 16px; font-size: 13px; color: #8a8f98; font-weight: 500; white-space: nowrap; vertical-align: top; border-bottom: 1px solid #f0f1f3;">
          ${escapeHtml(r.label)}
        </td>
        <td style="padding: 12px 16px; font-size: 14px; color: #0f1724; font-weight: 500; border-bottom: 1px solid #f0f1f3;">
          ${escapeHtml(r.value)}
        </td>
      </tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="sk">
<head><meta charset="utf-8" /></head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: 'Inter', Arial, sans-serif;">
  <div style="max-width: 560px; margin: 0 auto; padding: 32px 28px;">
    <p style="font-size: 18px; font-weight: bold; font-family: 'Space Grotesk', Arial, sans-serif; color: #0f1724; margin: 0 0 28px;">
      <span style="color: #1a9fff;">Web</span> na prenájom
    </p>
    <h1 style="font-size: 22px; font-weight: bold; font-family: 'Space Grotesk', Arial, sans-serif; color: #0f1724; margin: 0 0 8px;">
      Nový dopyt z webu
    </h1>
    <p style="font-size: 14px; color: #55606d; line-height: 1.6; margin: 0 0 24px;">
      Prišiel nový dopyt cez kontaktný formulár na webnaprenajom.sk.
    </p>
    <table style="width: 100%; border-collapse: collapse; background: #f8f9fb; border-radius: 12px; overflow: hidden;">
      ${rowsHtml}
    </table>
    <p style="font-size: 12px; color: #999999; margin: 30px 0 0;">
      Tento e-mail bol automaticky odoslaný z webnaprenajom.sk
    </p>
  </div>
</body>
</html>`
}

function buildPlainText(data: LeadPayload): string {
  const isConsultation = data.type === 'consultation'
  const typeSk =
    data.type === 'consultation' ? 'Konzultácia' :
    data.type === 'redesign' ? 'Redizajn webu' :
    data.type === 'order' ? 'Objednávka balíka' :
    'AI Návrh webu'

  const now = new Date()
  const submittedAt = now.toLocaleString('sk-SK', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'Europe/Prague',
  })

  let text = `Nový dopyt z webu\n\n`
  text += `Zdroj formulára: ${sourceLabel(data.source)}\n\n`
  text += `Typ dopytu: ${typeSk}\n\n`
  text += `Meno: ${data.name}\n\n`
  text += `E-mail: ${data.email}\n\n`
  if (data.phone) text += `Telefón: ${data.phone}\n\n`
  if (data.message) text += `Správa: ${data.message}\n\n`
  if (isConsultation && data.date) text += `Dátum konzultácie: ${formatDate(data.date)}\n\n`
  if (isConsultation && data.time) text += `Čas konzultácie: ${data.time}\n\n`
  text += `Jazyk webu: ${data.language.toUpperCase()}\n\n`
  text += `Odoslané: ${submittedAt}\n`

  return text
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const data: LeadPayload = await req.json()

    if (!data.name || !data.email) {
      return new Response(
        JSON.stringify({ error: 'Meno a e-mail sú povinné' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate & enforce length limits
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const trimmed = {
      name: String(data.name).trim().slice(0, 200),
      email: String(data.email).trim().slice(0, 254),
      phone: data.phone ? String(data.phone).trim().slice(0, 30) : undefined,
      message: data.message ? String(data.message).trim().slice(0, 2000) : undefined,
    }
    if (!emailRe.test(trimmed.email)) {
      return new Response(
        JSON.stringify({ error: 'Neplatný formát e-mailu' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    data.name = trimmed.name
    data.email = trimmed.email
    data.phone = trimmed.phone
    data.message = trimmed.message

    // Save to database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { error: dbError } = await supabase.from('leads').insert({
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      message: data.message || null,
      type: data.type,
      consultation_date: data.date || null,
      consultation_time: data.time || null,
      language: data.language,
      source: data.source || null,
    })

    if (dbError) {
      console.error('DB insert error:', dbError)
    }

    // Send email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const html = buildEmailHtml(data)
    const text = buildPlainText(data)

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Web na prenájom <info@webnaprenajom.sk>',
        to: ['salelogics.sk@gmail.com'],
        subject: `Dopyt [${sourceLabel(data.source)}] - Web na prenájom`,
        html,
        text,
      }),
    })

    const resendResult = await resendResponse.json()

    if (!resendResponse.ok) {
      console.error('Resend API error:', resendResult)
      return new Response(
        JSON.stringify({ error: 'Could not submit your request. Please try again later.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Lead saved & email sent', { resend_id: resendResult.id })

    return new Response(
      JSON.stringify({ success: true, id: resendResult.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
