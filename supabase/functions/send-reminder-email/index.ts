import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

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

interface ReminderPayload {
  name: string
  email: string
}

function buildHtml(name: string): string {
  const safeName = name?.trim() || 'klient'
  return `<!DOCTYPE html>
<html lang="sk">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 28px;">
    <p style="font-size:18px;font-weight:bold;font-family:'Space Grotesk',Arial,sans-serif;color:#0f1724;margin:0 0 28px;">
      <span style="color:#1a9fff;">Web</span> na prenájom
    </p>
    <h1 style="font-size:22px;font-weight:bold;font-family:'Space Grotesk',Arial,sans-serif;color:#0f1724;margin:0 0 12px;">
      Pripomienka k Vášmu dopytu
    </h1>
    <p style="font-size:15px;color:#0f1724;line-height:1.6;margin:0 0 16px;">
      Dobrý deň ${safeName},
    </p>
    <p style="font-size:14px;color:#55606d;line-height:1.7;margin:0 0 16px;">
      pred časom ste prejavili záujem o náš <strong>web na prenájom</strong> — chceli sme sa s Vami len krátko spojiť, aby sme zistili, či je ponuka stále aktuálna a či Vám vieme s niečím pomôcť.
    </p>
    <p style="font-size:14px;color:#55606d;line-height:1.7;margin:0 0 24px;">
      Ak máte chvíľku, dajte nám prosím vedieť — radi pre Vás pripravíme nezáväznú ukážku alebo zodpovieme akékoľvek otázky.
    </p>
    <div style="margin:0 0 28px;">
      <a href="https://webnaprenajom.sk" style="display:inline-block;background:#1a9fff;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px;">
        Pozrieť ponuku
      </a>
    </div>
    <p style="font-size:14px;color:#55606d;line-height:1.6;margin:0 0 6px;">
      S pozdravom,
    </p>
    <p style="font-size:14px;color:#0f1724;font-weight:600;margin:0 0 24px;">
      Tím Web na prenájom
    </p>
    <p style="font-size:12px;color:#999999;margin:30px 0 0;border-top:1px solid #f0f1f3;padding-top:16px;">
      Tento e-mail bol odoslaný ako pripomienka k Vášmu predchádzajúcemu dopytu na webnaprenajom.sk.<br/>
      Ak si neželáte ďalšiu komunikáciu, jednoducho odpovedzte slovom „STOP".
    </p>
  </div>
</body>
</html>`
}

function buildText(name: string): string {
  const safeName = name?.trim() || 'klient'
  return `Dobrý deň ${safeName},

pred časom ste prejavili záujem o náš web na prenájom. Chceli sme sa s Vami krátko spojiť, či je ponuka stále aktuálna a či Vám vieme s niečím pomôcť.

Ak máte chvíľku, dajte nám prosím vedieť — radi pre Vás pripravíme nezáväznú ukážku alebo zodpovieme akékoľvek otázky.

Pozrite si ponuku: https://webnaprenajom.sk

S pozdravom,
Tím Web na prenájom

---
Tento e-mail bol odoslaný ako pripomienka k Vášmu predchádzajúcemu dopytu. Ak si neželáte ďalšiu komunikáciu, odpovedzte slovom „STOP".
`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const data: ReminderPayload = await req.json()

    if (!data?.email || !data?.name) {
      return new Response(
        JSON.stringify({ error: 'Meno a e-mail sú povinné' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const html = buildHtml(data.name)
    const text = buildText(data.name)

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Web na prenájom <info@webnaprenajom.sk>',
        to: [data.email],
        reply_to: 'salelogics.sk@gmail.com',
        subject: 'Pripomienka – Váš dopyt na Web na prenájom',
        html,
        text,
      }),
    })

    const resendResult = await resendResponse.json()

    if (!resendResponse.ok) {
      console.error('Resend API error:', resendResult)
      return new Response(
        JSON.stringify({ error: 'Email send failed', details: resendResult }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Reminder email sent', { resend_id: resendResult.id, to: data.email })

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
