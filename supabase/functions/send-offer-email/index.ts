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
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
  const token = authHeader.replace('Bearer ', '')
  const { data, error } = await supabase.auth.getClaims(token)
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

interface OfferPayload {
  name?: string
  email?: string
  emails?: string[] | string
  recipients?: Array<{ name?: string; email: string }>
}

const INCLUDED = [
  '<strong>Tvorba moderného webu na mieru</strong> alebo <strong>re-dizajn</strong> existujúceho',
  'Hosting, doména a firemné e-maily (info@vasafirma.sk)',
  'Mobilná optimalizácia + SEO príprava',
  'Možné nasadenie AI nástrojov — chatboty, automatizácie, CRM',
  'Starostlivosť, drobné úpravy a technická podpora',
  'Spustenie do 48 hodín',
]

const DISCOUNT_CODE = 'VITAJTE10'
const CTA_URL = `https://webnaprenajom.sk/#kontakt?discount=${DISCOUNT_CODE}`
const REPLY_EMAIL = 'info@webnaprenajom.sk'

function formatDateSk(d: Date): string {
  const day = d.getDate()
  const months = ['januára','februára','marca','apríla','mája','júna','júla','augusta','septembra','októbra','novembra','decembra']
  return `${day}. ${months[d.getMonth()]} ${d.getFullYear()}`
}

function buildQuickReplyMailto(subject: string, body: string): string {
  return `mailto:${REPLY_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

function buildHtml(name: string): string {
  const safeName = name?.trim() || 'klient'

  // Časové obmedzenie zľavy: 7 dní od odoslania
  const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const expiryStr = formatDateSk(expiry)

  const includedRows = INCLUDED.map(
    (item) => `
      <tr>
        <td style="vertical-align:top;width:26px;padding:6px 0;">
          <span style="display:inline-block;width:20px;height:20px;border-radius:50%;background:#1a9fff;color:#fff;text-align:center;line-height:20px;font-size:12px;font-weight:bold;">✓</span>
        </td>
        <td style="vertical-align:top;padding:6px 0 6px 4px;font-size:14.5px;color:#0f1724;line-height:1.55;">${item}</td>
      </tr>`,
  ).join('')

  const replyInfo = buildQuickReplyMailto(
    'Mám záujem o viac informácií',
    `Dobrý deň,\n\nrád/rada by som získal/a viac informácií o Vašej ponuke.\n\nĎakujem,\n${safeName}`,
  )
  const replyCallback = buildQuickReplyMailto(
    'Prosím o spätné zavolanie',
    `Dobrý deň,\n\nprosím Vás o spätné zavolanie ohľadom ponuky.\n\nMeno: ${safeName}\nTelefón: [doplňte]\nNajlepší čas: [doplňte]\n\nĎakujem.`,
  )
  const replyMeeting = buildQuickReplyMailto(
    'Naplánovať konzultáciu',
    `Dobrý deň,\n\nrád/rada by som si dohodol/a krátku online konzultáciu.\n\nNavrhované termíny:\n- \n- \n\nĎakujem,\n${safeName}`,
  )

  return `<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
</head>
<body style="margin:0;padding:0;background-color:#f4f7fb;font-family:'Inter','Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="max-width:620px;margin:0 auto;padding:24px 16px;">

    <!-- Karta -->
    <div style="background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,36,0.06);">

      <!-- HEADER -->
      <div style="padding:22px 28px 18px;border-bottom:1px solid #f0f3f7;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="font-size:17px;font-weight:700;font-family:'Space Grotesk',Arial,sans-serif;color:#0f1724;letter-spacing:-0.3px;">
              <span style="color:#1a9fff;">Web</span> na prenájom
            </td>
            <td style="text-align:right;">
              <span style="display:inline-block;background:#ffffff;border:1px solid #e6e8ec;border-radius:999px;padding:5px 11px;font-size:11.5px;color:#0f1724;font-weight:600;">
                <span style="color:#4285F4;">G</span><span style="color:#EA4335;">o</span><span style="color:#FBBC05;">o</span><span style="color:#4285F4;">g</span><span style="color:#34A853;">l</span><span style="color:#EA4335;">e</span>
                <span style="color:#FBBC05;font-size:12px;letter-spacing:1px;margin:0 4px;">★★★★★</span>
                <span style="color:#6b7280;">5,0</span>
              </span>
            </td>
          </tr>
        </table>
      </div>

      <!-- HERO -->
      <div style="padding:30px 28px 8px;">
        <h1 style="font-size:26px;font-weight:800;font-family:'Space Grotesk',Arial,sans-serif;color:#0f1724;margin:0 0 12px;line-height:1.25;letter-spacing:-0.5px;">
          Nemáte web alebo potrebujete <span style="color:#1a9fff;">nový?</span>
        </h1>
        <p style="font-size:14.5px;color:#6b7280;margin:0 0 20px;line-height:1.55;">
          Moderný web už od <strong style="color:#0f1724;">35 €/mesiac</strong> — bez vstupných nákladov, spustenie do 48 hodín.
        </p>

        <p style="font-size:15px;color:#0f1724;line-height:1.6;margin:0 0 10px;">Dobrý deň ${safeName},</p>
        <p style="font-size:14.5px;color:#55606d;line-height:1.7;margin:0 0 20px;">
          pri prehliadaní firiem na Googli nás zaujala Vaša spoločnosť a radi by sme Vám predstavili, ako Vám vieme pomôcť dostať Váš online priestor o úroveň vyššie.
        </p>
        <p style="font-size:14.5px;color:#55606d;line-height:1.7;margin:0 0 24px;">
          Špecializujeme sa na <strong style="color:#0f1724;background:#fff4cc;padding:1px 4px;border-radius:3px;">tvorbu moderných webových stránok a redizajn</strong> existujúcich webov, ktoré nie sú len vizitka, ale <strong style="color:#0f1724;background:#fff4cc;padding:1px 4px;border-radius:3px;">aktívne prinášajú viac zákazníkov a dopytov</strong>.
        </p>
      </div>

      <!-- ZĽAVA BADGE s časovým obmedzením -->
      <div style="padding:0 28px 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:linear-gradient(135deg,#1a9fff 0%,#0b6fc7 100%);border-radius:14px;">
          <tr>
            <td style="padding:16px 18px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="vertical-align:middle;">
                    <span style="display:inline-block;background:#ffffff;color:#0b6fc7;font-weight:800;font-size:12px;padding:5px 10px;border-radius:999px;letter-spacing:0.5px;font-family:'Space Grotesk',Arial,sans-serif;">
                      🎁 ZĽAVA −10 %
                    </span>
                  </td>
                  <td style="vertical-align:middle;text-align:right;color:#ffffff;font-size:13.5px;line-height:1.4;font-family:'Space Grotesk',Arial,sans-serif;font-weight:600;">
                    Z prvých 3 mesiacov<br/>
                    <span style="font-weight:500;font-size:11.5px;opacity:0.95;">⏳ Platí do <strong>${expiryStr}</strong></span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>

      <!-- ČO JE V CENE -->
      <div style="padding:0 28px 26px;">
        <div style="background:#f5fbff;border:1px solid #e3f1ff;border-radius:14px;padding:20px 22px;">
          <h2 style="font-size:15px;font-weight:700;font-family:'Space Grotesk',Arial,sans-serif;color:#0f1724;margin:0 0 12px;letter-spacing:-0.2px;">
            Čo dostanete za 35 €/mesiac
          </h2>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            ${includedRows}
          </table>
        </div>
      </div>

      <!-- CTA -->
      <div style="padding:0 28px 8px;text-align:center;">
        <a href="${CTA_URL}" style="display:inline-block;background:#1a9fff;color:#ffffff;text-decoration:none;font-weight:700;font-size:15.5px;padding:15px 30px;border-radius:12px;font-family:'Space Grotesk',Arial,sans-serif;box-shadow:0 6px 18px rgba(26,159,255,0.35);">
          Aktivovať zľavu −10 % →
        </a>
        <p style="font-size:12.5px;color:#8a93a0;margin:10px 0 0;line-height:1.5;">
          Po kliknutí sa kód <strong style="color:#0f1724;background:#eef6ff;padding:1px 6px;border-radius:4px;">${DISCOUNT_CODE}</strong> automaticky vloží do poznámky vo formulári.
        </p>
      </div>

      <!-- AUTOMATICKÉ ODPOVEDE -->
      <div style="padding:18px 28px 8px;">
        <p style="font-size:13px;color:#8a93a0;margin:0 0 10px;text-align:center;font-family:'Space Grotesk',Arial,sans-serif;font-weight:600;letter-spacing:0.3px;text-transform:uppercase;">
          Alebo odpovedzte jedným klikom
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="padding:5px 0;">
              <a href="${replyInfo}" style="display:block;background:#ffffff;border:1.5px solid #e3f1ff;color:#0f1724;text-decoration:none;font-size:13.5px;padding:11px 14px;border-radius:10px;font-weight:600;text-align:center;font-family:'Inter',Arial,sans-serif;">
                ✉️ Mám záujem o viac informácií
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:5px 0;">
              <a href="${replyCallback}" style="display:block;background:#ffffff;border:1.5px solid #e3f1ff;color:#0f1724;text-decoration:none;font-size:13.5px;padding:11px 14px;border-radius:10px;font-weight:600;text-align:center;font-family:'Inter',Arial,sans-serif;">
                📞 Prosím o spätné zavolanie
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:5px 0;">
              <a href="${replyMeeting}" style="display:block;background:#ffffff;border:1.5px solid #e3f1ff;color:#0f1724;text-decoration:none;font-size:13.5px;padding:11px 14px;border-radius:10px;font-weight:600;text-align:center;font-family:'Inter',Arial,sans-serif;">
                📅 Naplánovať konzultáciu
              </a>
            </td>
          </tr>
        </table>
        <p style="font-size:12px;color:#8a93a0;margin:10px 0 0;text-align:center;line-height:1.5;">
          Stačí kliknúť — predvyplní sa Vám e-mail, len ho odošlite.
        </p>
      </div>

      <!-- PODPIS -->
      <div style="padding:22px 28px 24px;border-top:1px solid #f0f3f7;background:#fafbfc;margin-top:18px;">
        <p style="font-size:14px;color:#0f1724;font-weight:700;margin:0 0 4px;font-family:'Space Grotesk',Arial,sans-serif;">Tím Web na prenájom</p>
        <p style="font-size:13px;color:#55606d;margin:0;">
          <a href="https://webnaprenajom.sk" style="color:#1a9fff;text-decoration:none;">webnaprenajom.sk</a> · 0911 821 937
        </p>
      </div>
    </div>

    <p style="font-size:11.5px;color:#a0a8b3;line-height:1.55;margin:18px 8px 0;text-align:center;">
      Tento e-mail bol odoslaný ako obchodná ponuka. Ak si neželáte ďalšiu komunikáciu, odpovedzte slovom „STOP".
    </p>
  </div>
</body>
</html>`
}

function buildText(name: string): string {
  const safeName = name?.trim() || 'klient'
  const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const expiryStr = formatDateSk(expiry)
  const included = INCLUDED.map((i) => '  ✓ ' + i.replace(/<[^>]+>/g, '')).join('\n')

  return `Nemáte web alebo potrebujete nový?
Moderný web už od 35 €/mesiac — bez vstupných nákladov.

⭐⭐⭐⭐⭐  Hodnotenie 5,0 na Google

Dobrý deň ${safeName},

pri prehliadaní firiem na Googli nás zaujala Vaša spoločnosť a radi by sme Vám predstavili, ako Vám vieme pomôcť dostať Váš online priestor o úroveň vyššie.

Špecializujeme sa na TVORBU MODERNÝCH WEBOVÝCH STRÁNOK A REDIZAJN existujúcich webov, ktoré nie sú len vizitka, ale AKTÍVNE PRINÁŠAJÚ VIAC ZÁKAZNÍKOV A DOPYTOV.

🎁 ZĽAVA −10 % z prvých 3 mesiacov — kód ${DISCOUNT_CODE}
⏳ Platí do ${expiryStr}

ČO DOSTANETE ZA 35 €/MESIAC:
${included}

➤ Aktivovať zľavu −10 %: ${CTA_URL}
   (kód ${DISCOUNT_CODE} sa automaticky vloží do poznámky)

ALEBO ODPOVEDZTE JEDNÝM KLIKOM:
- Mám záujem o viac informácií → odpovedzte na tento e-mail
- Prosím o spätné zavolanie → napíšte „ZAVOLAJTE" + Vaše číslo
- Naplánovať konzultáciu → napíšte „TERMÍN" + návrh dátumov

Tím Web na prenájom
webnaprenajom.sk · 0911 821 937

---
Ak si neželáte ďalšiu komunikáciu, odpovedzte slovom „STOP".
`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const data: OfferPayload = await req.json()

    // Normalize input → list of { name, email }
    const recipients: Array<{ name: string; email: string }> = []
    if (Array.isArray(data?.recipients)) {
      for (const r of data.recipients) {
        if (r?.email) recipients.push({ name: (r.name || '').trim(), email: String(r.email).trim() })
      }
    }
    if (data?.emails) {
      const list = Array.isArray(data.emails)
        ? data.emails
        : String(data.emails).split(/[,;\s\n]+/)
      for (const e of list) {
        const email = String(e || '').trim()
        if (email) recipients.push({ name: (data.name || '').trim(), email })
      }
    }
    if (data?.email) {
      recipients.push({ name: (data.name || '').trim(), email: String(data.email).trim() })
    }

    // Dedup + basic validation
    const seen = new Set<string>()
    const validEmailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const finalList = recipients.filter((r) => {
      const key = r.email.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return validEmailRe.test(r.email)
    })

    if (finalList.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Aspoň jeden platný e-mail je povinný' }),
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

    const results: Array<{ email: string; ok: boolean; id?: string; error?: string }> = []

    for (const r of finalList) {
      const html = buildHtml(r.name)
      const text = buildText(r.name)

      try {
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Web na prenájom <info@webnaprenajom.sk>',
            to: [r.email],
            reply_to: 'info@webnaprenajom.sk',
            subject: r.name ? `${r.name}, môžem sa spýtať na Váš web?` : 'Krátka otázka ohľadom Vášho webu',
            html,
            text,
            headers: {
              'List-Unsubscribe': '<mailto:info@webnaprenajom.sk?subject=STOP>, <https://webnaprenajom.sk/#kontakt>',
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
              'X-Entity-Ref-ID': crypto.randomUUID(),
              'Precedence': 'bulk',
            },
          }),
        })

        const resendResult = await resendResponse.json()
        if (!resendResponse.ok) {
          console.error('Resend API error:', r.email, resendResult)
          results.push({ email: r.email, ok: false, error: resendResult?.message || 'send failed' })
        } else {
          results.push({ email: r.email, ok: true, id: resendResult.id })
        }
      } catch (e) {
        results.push({ email: r.email, ok: false, error: e instanceof Error ? e.message : 'unknown' })
      }
    }

    const sent = results.filter((r) => r.ok).length
    const failed = results.length - sent
    console.log('Offer emails processed', { sent, failed })

    return new Response(
      JSON.stringify({ success: failed === 0, sent, failed, results }),
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
