import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { logEmailOutEvent } from '../_shared/communicationEvents.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const MONTHS_SK = [
  'január', 'február', 'marec', 'apríl', 'máj', 'jún',
  'júl', 'august', 'september', 'október', 'november', 'december',
]

async function requireAdmin(req: Request): Promise<{ ok: true } | { ok: false; response: Response }> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
  }
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
  const { data, error } = await sb.auth.getClaims(authHeader.replace('Bearer ', ''))
  if (error || !data?.claims?.sub) {
    return { ok: false, response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
  }
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: roleRow } = await admin.from('user_roles').select('role').eq('user_id', data.claims.sub).eq('role', 'admin').maybeSingle()
  if (!roleRow) {
    return { ok: false, response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
  }
  return { ok: true }
}

interface OverduePayload {
  email: string
  client_name?: string
  website_name: string
  website_url?: string
  month: number
  year: number
  amount: number
}

function buildHtml(d: OverduePayload): string {
  const name = (d.client_name || '').trim() || 'klient'
  const period = `${MONTHS_SK[d.month - 1] ?? d.month} ${d.year}`
  const amount = `${Number(d.amount).toFixed(2)} €`
  return `<!DOCTYPE html>
<html lang="sk">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 28px;">
    <p style="font-size:18px;font-weight:bold;font-family:'Space Grotesk',Arial,sans-serif;color:#0f1724;margin:0 0 28px;">
      <span style="color:#1a9fff;">Web</span> na prenájom
    </p>
    <div style="background:#fff1f0;border:1px solid #ffd6d2;border-radius:12px;padding:18px 20px;margin:0 0 24px;">
      <h1 style="font-size:20px;font-weight:bold;font-family:'Space Grotesk',Arial,sans-serif;color:#b91c1c;margin:0 0 6px;">
        ⚠️ Vaša stránka bola dočasne deaktivovaná
      </h1>
      <p style="font-size:13px;color:#7a1d1d;margin:0;">Dôvod: omeškaná platba za prenájom</p>
    </div>
    <p style="font-size:15px;color:#0f1724;line-height:1.6;margin:0 0 16px;">Dobrý deň ${name},</p>
    <p style="font-size:14px;color:#55606d;line-height:1.7;margin:0 0 16px;">
      informujeme Vás, že Vaša webová stránka <strong>${d.website_name}</strong>${d.website_url ? ` (<a href="${d.website_url}" style="color:#1a9fff;">${d.website_url}</a>)` : ''} je momentálne <strong>neaktívna z dôvodu omeškanej platby</strong> za obdobie <strong>${period}</strong>.
    </p>
    <p style="font-size:14px;color:#55606d;line-height:1.7;margin:0 0 16px;">
      Pre znovuaktiváciu stránky je potrebné <strong>uhradiť dlžnú sumu ${amount}</strong>. Po prijatí platby bude stránka opätovne sprístupnená spravidla do 24 hodín.
    </p>
    <div style="background:#f7f9fc;border-radius:10px;padding:14px 16px;margin:0 0 24px;">
      <p style="font-size:13px;color:#0f1724;margin:0 0 4px;"><strong>Dlžná suma:</strong> ${amount}</p>
      <p style="font-size:13px;color:#0f1724;margin:0;"><strong>Obdobie:</strong> ${period}</p>
    </div>
    <p style="font-size:14px;color:#55606d;line-height:1.7;margin:0 0 24px;">
      Ak ste platbu už uhradili alebo máte akékoľvek otázky, neváhajte nás kontaktovať odpoveďou na tento e-mail.
    </p>
    <p style="font-size:14px;color:#55606d;line-height:1.6;margin:0 0 6px;">S pozdravom,</p>
    <p style="font-size:14px;color:#0f1724;font-weight:600;margin:0;">Tím Web na prenájom</p>
    <p style="font-size:12px;color:#999999;margin:30px 0 0;border-top:1px solid #f0f1f3;padding-top:16px;">
      Tento e-mail bol odoslaný v súvislosti s Vašou aktívnou službou na webnaprenajom.sk.
    </p>
  </div>
</body>
</html>`
}

function buildText(d: OverduePayload): string {
  const name = (d.client_name || '').trim() || 'klient'
  const period = `${MONTHS_SK[d.month - 1] ?? d.month} ${d.year}`
  const amount = `${Number(d.amount).toFixed(2)} €`
  return `Dobrý deň ${name},

Vaša webová stránka ${d.website_name}${d.website_url ? ` (${d.website_url})` : ''} je momentálne NEAKTÍVNA z dôvodu omeškanej platby za obdobie ${period}.

Pre znovuaktiváciu stránky je potrebné uhradiť dlžnú sumu ${amount}. Po prijatí platby bude stránka opätovne sprístupnená spravidla do 24 hodín.

Ak ste platbu už uhradili, alebo máte otázky, odpovedzte prosím na tento e-mail.

S pozdravom,
Tím Web na prenájom
`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const data: OverduePayload = await req.json()
    if (!data?.email || !data?.website_name || !data?.month || !data?.year) {
      return new Response(JSON.stringify({ error: 'Chýbajú povinné polia (email, website_name, month, year)' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const html = buildHtml(data)
    const text = buildText(data)
    const subject = `Omeškaná platba – stránka ${data.website_name} je dočasne neaktívna`

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Web na prenájom <info@webnaprenajom.sk>',
        to: [data.email],
        reply_to: 'salelogics.sk@gmail.com',
        subject,
        html,
        text,
      }),
    })
    const resendResult = await resendResponse.json()
    if (!resendResponse.ok) {
      console.error('Resend API error:', resendResult)
      return new Response(JSON.stringify({ error: 'Email send failed', details: resendResult }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    await logEmailOutEvent(admin, {
      customer_email: data.email,
      customer_id: null,
      title: subject,
      subject,
      body_text: text,
      resend_id: resendResult.id,
      edge_function: 'send-overdue-email',
      source_table: null,
      source_id: null,
    })

    return new Response(JSON.stringify({ success: true, id: resendResult.id }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('send-overdue-email error:', message)
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
