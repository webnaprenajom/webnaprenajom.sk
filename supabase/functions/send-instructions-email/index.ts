import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function requireAdmin(req: Request): Promise<{ ok: true } | { ok: false; response: Response }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
  }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const { data, error } = await sb.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (error || !data?.claims?.sub) {
    return { ok: false, response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
  }
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", data.claims.sub).eq("role", "admin").maybeSingle();
  if (!roleRow) {
    return { ok: false, response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }) };
  }
  return { ok: true };
}

interface InstructionsPayload {
  name: string;
  email: string;
  amount?: number | null;
}

const PROVIDER = {
  name: "Salelogics Group s. r. o.",
  ico: "57 506 191",
  dic: "2122783520",
  iban: "SK18 1100 0000 0029 4829 2385",
  bic: "TATRSKBX",
};

function buildHtml(name: string, amount: number): string {
  const safeName = name?.trim() || "klient";
  const amountStr = `${amount.toLocaleString("sk-SK", { maximumFractionDigits: 2 })} €`;
  return `<!DOCTYPE html>
<html lang="sk">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 28px;">
    <p style="font-size:18px;font-weight:bold;font-family:'Space Grotesk',Arial,sans-serif;color:#0f1724;margin:0 0 28px;">
      <span style="color:#1a9fff;">Web</span> na prenájom
    </p>
    <h1 style="font-size:24px;font-weight:bold;font-family:'Space Grotesk',Arial,sans-serif;color:#0f1724;margin:0 0 16px;">
      Inštrukcie pred objednávkou
    </h1>
    <p style="font-size:15px;color:#0f1724;line-height:1.6;margin:0 0 16px;">
      Dobrý deň ${safeName},
    </p>
    <p style="font-size:14px;color:#55606d;line-height:1.7;margin:0 0 20px;">
      ďakujeme za záujem o službu <strong>Web na prenájom</strong>. Predtým, než pristúpime k samotnej objednávke a zaslaniu zmluvy, prosíme o krátke potvrdenie a doplnenie pár údajov.
    </p>

    <div style="background:#f5faff;border:1px solid #d0e7fb;border-radius:10px;padding:16px 18px;margin:0 0 20px;">
      <p style="margin:0 0 6px;font-size:13px;color:#55606d;">Predbežný mesačný poplatok</p>
      <p style="margin:0;font-size:22px;font-weight:bold;color:#1a9fff;">${amountStr}</p>
      <p style="margin:8px 0 0;font-size:12px;color:#55606d;">0 € vstupné náklady · po 12 mesiacoch zľava 5 % každý ďalší rok.</p>
    </div>

    <h2 style="font-size:16px;font-weight:bold;color:#0f1724;margin:8px 0 10px;">Čo potrebujeme od Vás</h2>
    <ol style="font-size:14px;color:#55606d;line-height:1.8;margin:0 0 20px;padding-left:20px;">
      <li><strong>Fakturačné údaje firmy</strong> – obchodné meno, sídlo, IČO, DIČ / IČ DPH.</li>
      <li><strong>Kontaktnú osobu</strong> – meno, telefón a e-mail pre komunikáciu.</li>
      <li><strong>Doménu</strong> – ak už máte vlastnú, uveďte ju; inak Vám pomôžeme s registráciou.</li>
      <li><strong>Podklady na web</strong> – logo, fotografie, texty (ak ich máte). Ak nie, vieme texty a logo dodať zdarma.</li>
      <li><strong>Potvrdenie ceny a rozsahu</strong> – odpovedzte prosím na tento e-mail s vyjadrením, či súhlasíte s predbežnou ponukou.</li>
    </ol>

    <h2 style="font-size:16px;font-weight:bold;color:#0f1724;margin:0 0 10px;">Ako to bude pokračovať</h2>
    <ol style="font-size:14px;color:#55606d;line-height:1.7;margin:0 0 20px;padding-left:20px;">
      <li>Pošlete nám potvrdenie a fakturačné údaje na <a href="mailto:info@webnaprenajom.sk" style="color:#1a9fff;">info@webnaprenajom.sk</a>.</li>
      <li>My pripravíme <strong>návrh zmluvy</strong> upravený presne podľa Vašej objednávky.</li>
      <li>Po Vašom súhlase Vám obratom zašleme <strong>oficiálnu objednávku a zmluvu na podpis</strong>.</li>
      <li>Web spúšťame typicky do 48 hodín od podpisu a úhrady prvej zálohy.</li>
    </ol>

    <div style="background:#fff8e6;border:1px solid #ffe2a8;border-radius:10px;padding:14px 16px;margin:0 0 24px;">
      <p style="margin:0;font-size:13px;color:#5a4500;line-height:1.6;">
        ℹ️ <strong>Toto ešte nie je záväzná objednávka.</strong> Ide o prípravný krok – po Vašom potvrdení Vám pošleme samostatný e-mail s objednávkou a návrhom zmluvy v prílohe.
      </p>
    </div>

    <p style="font-size:14px;color:#55606d;line-height:1.7;margin:0 0 24px;">
      V prípade akýchkoľvek otázok sme Vám k dispozícii na <a href="mailto:info@webnaprenajom.sk" style="color:#1a9fff;">info@webnaprenajom.sk</a> alebo telefonicky na <strong>+421 911 638 657</strong>.
    </p>

    <p style="font-size:14px;color:#55606d;line-height:1.6;margin:0 0 6px;">S pozdravom,</p>
    <p style="font-size:14px;color:#0f1724;font-weight:600;margin:0 0 24px;">Tím Web na prenájom</p>

    <p style="font-size:11px;color:#999;margin:24px 0 0;border-top:1px solid #f0f1f3;padding-top:12px;line-height:1.5;">
      ${PROVIDER.name} · IČO: ${PROVIDER.ico} · DIČ: ${PROVIDER.dic}<br/>
      IBAN: ${PROVIDER.iban} · BIC: ${PROVIDER.bic}
    </p>
  </div>
</body>
</html>`;
}

function buildText(name: string, amount: number): string {
  const safeName = name?.trim() || "klient";
  return `Dobrý deň ${safeName},

ďakujeme za záujem o službu Web na prenájom. Predtým, než pristúpime k objednávke a zaslaniu zmluvy, prosíme o krátke potvrdenie.

Predbežný mesačný poplatok: ${amount.toLocaleString("sk-SK")} €
(0 € vstupné náklady, po 12 mesiacoch zľava 5 % každý ďalší rok)

Čo od Vás potrebujeme:
1. Fakturačné údaje firmy (obchodné meno, sídlo, IČO, DIČ).
2. Kontaktnú osobu (meno, telefón, e-mail).
3. Doménu – vlastnú alebo Vám ju zaregistrujeme.
4. Podklady na web (logo, fotografie, texty) – ak nemáte, dodáme zdarma.
5. Potvrdenie ceny a rozsahu odpoveďou na tento e-mail.

Ako pokračujeme:
1. Pošlete nám potvrdenie a fakturačné údaje na info@webnaprenajom.sk.
2. Pripravíme návrh zmluvy podľa Vašej objednávky.
3. Po Vašom súhlase Vám zašleme oficiálnu objednávku a zmluvu na podpis.

Toto ešte nie je záväzná objednávka – ide o prípravný krok.

S pozdravom,
Tím Web na prenájom
`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const data: InstructionsPayload = await req.json();
    if (!data?.email || !data?.name) {
      return new Response(
        JSON.stringify({ error: "Meno a e-mail sú povinné" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const monthly = typeof data.amount === "number" && data.amount > 0 ? data.amount : 49;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Web na prenájom <info@webnaprenajom.sk>",
        to: [data.email],
        reply_to: "salelogics.sk@gmail.com",
        subject: "Inštrukcie pred objednávkou – Web na prenájom",
        html: buildHtml(data.name, monthly),
        text: buildText(data.name, monthly),
      }),
    });

    const resendResult = await resendResponse.json();
    if (!resendResponse.ok) {
      console.error("Resend API error:", resendResult);
      return new Response(
        JSON.stringify({ error: "Email send failed", details: resendResult }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("Instructions email sent", { resend_id: resendResult.id, to: data.email });
    return new Response(
      JSON.stringify({ success: true, id: resendResult.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
