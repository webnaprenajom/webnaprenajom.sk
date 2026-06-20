import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { logEmailOutEvent } from '../_shared/communicationEvents.ts'
import { corsHeaders, requireCrmOwner } from '../_shared/requireCrmOwner.ts'

interface Payload {
  name?: string
  email: string
  prizeLabel?: string
  prizeValue?: number
  couponCode: string
}

function buildHtml(p: Payload): string {
  const safeName = p.name?.trim() || 'klient'
  const code = p.couponCode.toUpperCase()
  const prize = p.prizeValue && p.prizeValue > 0
    ? `${p.prizeValue}% zľavu`
    : (p.prizeLabel || 'zľavu')
  const redeemUrl = `https://webnaprenajom.sk/?discount=${encodeURIComponent(code)}#kontakt`

  return `<!DOCTYPE html>
<html lang="sk">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 28px;">
    <p style="font-size:18px;font-weight:bold;font-family:'Space Grotesk',Arial,sans-serif;color:#0f1724;margin:0 0 28px;">
      <span style="color:#1a9fff;">Web</span> na prenájom
    </p>
    <h1 style="font-size:22px;font-weight:bold;font-family:'Space Grotesk',Arial,sans-serif;color:#0f1724;margin:0 0 12px;">
      🎡 Vaša výhra na Vás stále čaká
    </h1>
    <p style="font-size:15px;color:#0f1724;line-height:1.6;margin:0 0 16px;">
      Dobrý deň ${safeName},
    </p>
    <p style="font-size:14px;color:#55606d;line-height:1.7;margin:0 0 20px;">
      pred časom ste si na našej stránke zatočili kolesom šťastia a vyhrali ste <strong>${prize}</strong>.
      Chceli sme Vám pripomenúť, že Vašu zľavu môžete kedykoľvek uplatniť pri objednávke služby <strong>Web na prenájom</strong>.
    </p>

    <div style="background:#f0f8ff;border:1px dashed #1a9fff;border-radius:12px;padding:18px;text-align:center;margin:0 0 24px;">
      <p style="margin:0 0 6px;font-size:12px;color:#55606d;text-transform:uppercase;letter-spacing:1px;">Váš zľavový kód</p>
      <p style="margin:0;font-size:24px;font-weight:bold;color:#1a9fff;font-family:monospace;letter-spacing:2px;">${code}</p>
    </div>

    <p style="font-size:14px;color:#55606d;line-height:1.7;margin:0 0 20px;">
      Stačí kliknúť nižšie, vyplniť krátky formulár a my Vám obratom pošleme cenovú ponuku so zľavou,
      kontaktné údaje a inštrukcie na ďalšie kroky.
    </p>

    <div style="margin:0 0 28px;text-align:center;">
      <a href="${redeemUrl}" style="display:inline-block;background:#1a9fff;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:10px;">
        Uplatniť zľavu a poslať dopyt →
      </a>
    </div>

    <p style="font-size:13px;color:#55606d;line-height:1.6;margin:0 0 6px;">
      Ak by ste mali otázky, môžete nám napísať priamo na
      <a href="mailto:info@webnaprenajom.sk" style="color:#1a9fff;">info@webnaprenajom.sk</a>
      alebo zavolať na <strong>0911 821 937</strong>.
    </p>

    <p style="font-size:14px;color:#0f1724;font-weight:600;margin:24px 0 0;">
      Tím Web na prenájom
    </p>
    <p style="font-size:12px;color:#999999;margin:30px 0 0;border-top:1px solid #f0f1f3;padding-top:16px;">
      Tento e-mail bol odoslaný ako pripomienka k Vašej výhre v kolese šťastia na webnaprenajom.sk.
      Ak si neželáte ďalšiu komunikáciu, odpovedzte slovom „STOP".
    </p>
  </div>
</body>
</html>`
}

function buildText(p: Payload): string {
  const safeName = p.name?.trim() || 'klient'
  const code = p.couponCode.toUpperCase()
  const prize = p.prizeValue && p.prizeValue > 0 ? `${p.prizeValue}% zľavu` : (p.prizeLabel || 'zľavu')
  const url = `https://webnaprenajom.sk/?discount=${encodeURIComponent(code)}#kontakt`
  return `Dobrý deň ${safeName},

pred časom ste si zatočili kolesom šťastia na webnaprenajom.sk a vyhrali ste ${prize}.
Vašu zľavu môžete stále uplatniť pri objednávke služby Web na prenájom.

Váš zľavový kód: ${code}

Uplatniť zľavu a poslať dopyt: ${url}

Otázky: info@webnaprenajom.sk · tel. 0911 821 937

Tím Web na prenájom
`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const auth = await requireCrmOwner(req)
  if (!auth.ok) return auth.response

  try {
    const data: Payload = await req.json()
    if (!data?.email || !data?.couponCode) {
      return new Response(JSON.stringify({ error: 'email a couponCode sú povinné' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Web na prenájom <info@webnaprenajom.sk>',
        to: [data.email],
        reply_to: 'salelogics.sk@gmail.com',
        subject: `🎡 Vaša zľava ${data.couponCode.toUpperCase()} na Vás stále čaká`,
        html: buildHtml(data),
        text: buildText(data),
      }),
    })
    const result = await resp.json()
    if (!resp.ok) {
      console.error('Resend error', result)
      return new Response(JSON.stringify({ error: 'Email send failed', details: result }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const subject = `🎡 Vaša zľava ${data.couponCode.toUpperCase()} na Vás stále čaká`
    const logResult = await logEmailOutEvent(admin, {
      customer_email: data.email,
      title: subject,
      subject,
      body_text: buildText(data),
      resend_id: result.id,
      edge_function: 'send-wheel-reminder',
    })
    if (!logResult.ok) console.warn('[communication_events] wheel reminder log failed', logResult.error)

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
