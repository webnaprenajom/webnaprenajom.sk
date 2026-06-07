import { jsPDF } from "https://esm.sh/jspdf@2.5.1";
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
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await sb.auth.getClaims(token);
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

interface OrderPayload {
  name: string;
  email: string;
  amount?: number | null;
  company_name?: string | null;
  company_address?: string | null;
  company_ico?: string | null;
  company_dic?: string | null;
}

const PROVIDER = {
  name: "Salelogics Group s. r. o.",
  address: "Čingovská 10, 040 12 Košice",
  ico: "57 506 191",
  dic: "2122783520",
  iban: "SK18 1100 0000 0029 4829 2385",
  bic: "TATRSKBX",
};

// --- Slovak diacritics → ASCII (jsPDF default font is WinAnsi-only) ---
const stripDiacritics = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function generateContractPdf(data: OrderPayload): Uint8Array {
  const monthly = typeof data.amount === "number" && data.amount > 0
    ? data.amount
    : 49;
  const monthlyStr = `${monthly.toLocaleString("sk-SK", { maximumFractionDigits: 2 })} EUR`;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = margin;

  const t = (s: string) => stripDiacritics(s);

  const writeLine = (text: string, opts: { size?: number; bold?: boolean; gap?: number; color?: [number, number, number] } = {}) => {
    const { size = 10, bold = false, gap = 4, color = [15, 23, 36] } = opts;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(t(text), contentW);
    for (const line of lines) {
      if (y > 280) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += gap;
    }
  };

  const spacer = (h = 3) => { y += h; };

  // Header
  doc.setFillColor(26, 159, 255);
  doc.rect(0, 0, pageW, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(t("Web na prenajom  |  webnaprenajom.sk  |  +421 911 638 657"), margin, 8);
  y = 22;

  writeLine("ZMLUVA O PRENAJME A POSKYTOVANI SLUZIEB WEBOVEJ STRANKY", { size: 14, bold: true, gap: 7 });
  spacer(2);

  writeLine("SLUZBA", { size: 11, bold: true, gap: 5 });
  writeLine(
    "Tvorba, sprava a prevadzka webovej stranky na mieru podla poziadaviek objednavatela. Sucastou sluzby je najma technicka udrzba, aktualizacie, hosting, zakladna bezpecnost a podpora. Webova stranka je poskytovana formou prenajmu pocas trvania zmluvneho vztahu, pricom zostava vo vlastnictve poskytovatela, ak nie je dohodnute inak.",
    { gap: 5 }
  );
  spacer(2);

  writeLine("CLANOK I - ZMLUVNE STRANY", { size: 11, bold: true, gap: 5 });
  writeLine("Poskytovatel:", { bold: true, gap: 5 });
  writeLine(`Obchodne meno: ${PROVIDER.name}`);
  writeLine(`Sidlo: ${PROVIDER.address}`);
  writeLine(`ICO: ${PROVIDER.ico}`);
  writeLine(`DIC / IC DPH: ${PROVIDER.dic}`);
  writeLine(`IBAN: ${PROVIDER.iban}   BIC: ${PROVIDER.bic}`, { gap: 6 });

  writeLine("Objednavatel:", { bold: true, gap: 5 });
  writeLine(`Obchodne meno: ${data.company_name || data.name || "[___]"}`);
  writeLine(`Sidlo: ${data.company_address || "[___]"}`);
  writeLine(`ICO: ${data.company_ico || "[___]"}`);
  writeLine(`DIC / IC DPH: ${data.company_dic || "[___]"}`);
  writeLine(`Kontaktna osoba: ${data.name}   E-mail: ${data.email}`, { gap: 6 });

  writeLine("CLANOK II - PREDMET ZMLUVY", { size: 11, bold: true, gap: 5 });
  writeLine("1. Poskytovatel sa zavazuje poskytnut Objednavatelovi do uzivania webovu stranku formou prenajmu.");
  writeLine("2. Sucastou sluzby je najma: hosting webovej stranky, technicka sprava a udrzba, aktualizacie systemu, zakladna bezpecnost, zakladna technicka podpora.");
  writeLine("3. Webova stranka je pocas celej doby trvania zmluvy vo vlastnictve Poskytovatela, pokial nie je dohodnute inak.");
  writeLine("4. Objednavatel ma pravo webovu stranku uzivat vyhradne pocas trvania zmluvy.", { gap: 6 });

  writeLine("CLANOK III - CENA A PLATBY", { size: 11, bold: true, gap: 5 });
  // Highlight price line
  doc.setFillColor(232, 245, 255);
  doc.rect(margin - 1, y - 4, contentW + 2, 8, "F");
  writeLine(`1. Mesacny poplatok za sluzbu "Webstranka na prenajom" je ${monthlyStr}.`, { bold: true, gap: 6 });
  writeLine("2. Sluzba je fakturovana mesacne vopred.");
  writeLine("3. Fakturacne obdobie je kalendarny mesiac (od 1. do posledneho dna v mesiaci).");
  writeLine("4. Datum dodania sluzby je vzdy prvy den fakturovaneho obdobia.");
  writeLine("5. Splatnost faktury je 7 dni, pricom sluzba je poskytovana az po uhrade faktury.");
  writeLine("6. Po uplynuti 12 mesiacov trvania zmluvy sa mesacny pausal znizuje o 5 % za kazdy dalsi rok, pricom znizenie sa uplatnuje vzdy od zaciatku nasledujuceho rocneho obdobia.", { gap: 6 });

  writeLine("CLANOK IV - ROZSAH PODPORY", { size: 11, bold: true, gap: 5 });
  writeLine("1. Zakladna podpora zahrna beznu technicku spravu a drobne upravy webovej stranky.");
  writeLine("2. Rozsah zakladnej podpory je maximalne 10 hodin mesacne.");
  writeLine("3. Upravy nad ramec zakladnej podpory budu uctovane samostatne podla aktualneho cennika Poskytovatela.", { gap: 6 });

  writeLine("CLANOK V - DOBA TRVANIA", { size: 11, bold: true, gap: 5 });
  writeLine("1. Minimalna viazanost zmluvy je 12 mesiacov.");
  writeLine("2. Po uplynuti viazanosti je mozne zmluvu vypovedat s vypovednou lehotou 1 mesiac.");
  writeLine("3. Vypovedna lehota zacina plynut od prveho dna nasledujuceho mesiaca po doruceni vypovede.", { gap: 6 });

  writeLine("CLANOK VI - OMESKANIE A POZASTAVENIE SLUZBY", { size: 11, bold: true, gap: 5 });
  writeLine("1. V pripade omeskania s uhradou faktury moze Poskytovatel uctovat zakonny urok z omeskania.");
  writeLine("2. V pripade neuhradenia faktury do datumu splatnosti si Poskytovatel vyhradzuje pravo sluzbu po druhej vyzve pozastavit.");
  writeLine("3. Obnovenie sluzby je mozne az po uhradeni dlznej sumy.", { gap: 6 });

  writeLine("CLANOK VII - UKONCENIE ZMLUVY", { size: 11, bold: true, gap: 5 });
  writeLine("1. Po ukonceni zmluvy bude webova stranka deaktivovana a zalohovana v suboroch winrar.");
  writeLine("2. Objednavatel nema narok na dalsie pouzivanie webovej stranky na nasom webhostingu po ukonceni zmluvy, pokial sa zmluvne strany nedohodnu inak.");
  writeLine("3. Objednavatel ma moznost odkupit webovu stranku za cenu dohodnutu individualne.", { gap: 6 });

  writeLine("CLANOK VIII - ZAVERECNE USTANOVENIA", { size: 11, bold: true, gap: 5 });
  writeLine("1. Zmluva nadobuda platnost a ucinnost dnom podpisu oboma zmluvnymi stranami.");
  writeLine("2. Zmluva je vyhotovena v dvoch rovnopisoch, pricom kazda strana obdrzi jeden rovnopis.");
  writeLine("3. Zmluvne strany potvrdzuju, ze si zmluvu precitali, jej obsahu porozumeli a na znak suhlasu ju podpisuju.");
  writeLine("4. Pravne vztahy neupravene touto zmluvou sa riadia pravnym poriadkom Slovenskej republiky, najma prislusnymi ustanoveniami Obchodneho zakonnika.", { gap: 8 });

  const today = new Date().toLocaleDateString("sk-SK");
  writeLine(`V Kosiciach dna ${today}`, { gap: 14 });

  // Signature blocks
  if (y > 250) { doc.addPage(); y = margin; }
  doc.setDrawColor(180, 180, 180);
  doc.line(margin, y, margin + 70, y);
  doc.line(pageW - margin - 70, y, pageW - margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(85, 96, 109);
  doc.text("Poskytovatel", margin + 25, y);
  doc.text("Objednavatel", pageW - margin - 50, y);

  return new Uint8Array(doc.output("arraybuffer"));
}

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
      Potvrdenie objednávky a návrh zmluvy
    </h1>
    <p style="font-size:15px;color:#0f1724;line-height:1.6;margin:0 0 16px;">
      Dobrý deň ${safeName},
    </p>
    <p style="font-size:14px;color:#55606d;line-height:1.7;margin:0 0 16px;">
      ďakujeme za Vašu objednávku služby <strong>Web na prenájom</strong>. V prílohe nájdete <strong>návrh zmluvy o prenájme a poskytovaní služieb webovej stránky</strong> upravený podľa dohodnutých podmienok.
    </p>

    <div style="background:#f5faff;border:1px solid #d0e7fb;border-radius:10px;padding:16px 18px;margin:0 0 20px;">
      <p style="margin:0 0 6px;font-size:13px;color:#55606d;">Mesačný poplatok</p>
      <p style="margin:0;font-size:22px;font-weight:bold;color:#1a9fff;">${amountStr}</p>
      <p style="margin:8px 0 0;font-size:12px;color:#55606d;">Po 12 mesiacoch sa paušál znižuje o 5 % každý ďalší rok.</p>
    </div>

    <h2 style="font-size:16px;font-weight:bold;color:#0f1724;margin:8px 0 10px;">Údaje pre úhradu</h2>
    <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;color:#0f1724;margin:0 0 20px;">
      <tr><td style="padding:4px 0;color:#55606d;">Príjemca:</td><td style="padding:4px 0;font-weight:600;">${PROVIDER.name}</td></tr>
      <tr><td style="padding:4px 0;color:#55606d;">IČO:</td><td style="padding:4px 0;font-weight:600;">${PROVIDER.ico}</td></tr>
      <tr><td style="padding:4px 0;color:#55606d;">DIČ:</td><td style="padding:4px 0;font-weight:600;">${PROVIDER.dic}</td></tr>
      <tr><td style="padding:4px 0;color:#55606d;">IBAN:</td><td style="padding:4px 0;font-weight:600;">${PROVIDER.iban}</td></tr>
      <tr><td style="padding:4px 0;color:#55606d;">BIC/SWIFT:</td><td style="padding:4px 0;font-weight:600;">${PROVIDER.bic}</td></tr>
    </table>

    <h2 style="font-size:16px;font-weight:bold;color:#0f1724;margin:0 0 10px;">Ako pokračujeme</h2>
    <ol style="font-size:14px;color:#55606d;line-height:1.7;margin:0 0 20px;padding-left:20px;">
      <li>Skontrolujte priloženú zmluvu a doplňte fakturačné údaje na strane Objednávateľa.</li>
      <li>Podpísanú zmluvu nám zašlite späť na <a href="mailto:info@webnaprenajom.sk" style="color:#1a9fff;">info@webnaprenajom.sk</a>.</li>
      <li>Po prijatí podpisu Vám obratom vystavíme prvú zálohovú faktúru.</li>
      <li>Web spúšťame typicky do 48 hodín od úhrady.</li>
    </ol>

    <p style="font-size:14px;color:#55606d;line-height:1.7;margin:0 0 24px;">
      Ak budete mať akékoľvek otázky, sme Vám k dispozícii na <a href="mailto:info@webnaprenajom.sk" style="color:#1a9fff;">info@webnaprenajom.sk</a> alebo telefonicky na <strong>+421 911 638 657</strong>.
    </p>

    <p style="font-size:14px;color:#55606d;line-height:1.6;margin:0 0 6px;">S pozdravom,</p>
    <p style="font-size:14px;color:#0f1724;font-weight:600;margin:0 0 24px;">Tím Web na prenájom</p>
    <p style="font-size:12px;color:#999999;margin:30px 0 0;border-top:1px solid #f0f1f3;padding-top:16px;">
      Tento e-mail je potvrdením Vašej objednávky a obsahuje návrh zmluvy v prílohe (PDF).
    </p>
  </div>
</body>
</html>`;
}

function buildText(name: string, amount: number): string {
  const safeName = name?.trim() || "klient";
  return `Dobrý deň ${safeName},

ďakujeme za Vašu objednávku služby Web na prenájom. V prílohe nájdete návrh zmluvy.

Mesačný poplatok: ${amount.toLocaleString("sk-SK")} €
Po 12 mesiacoch sa paušál znižuje o 5 % každý ďalší rok.

Údaje pre úhradu:
Príjemca: ${PROVIDER.name}
IČO: ${PROVIDER.ico}
DIČ: ${PROVIDER.dic}
IBAN: ${PROVIDER.iban}
BIC/SWIFT: ${PROVIDER.bic}

Podpísanú zmluvu nám prosím zašlite na info@webnaprenajom.sk.

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
    const data: OrderPayload = await req.json();
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

    // Helper: bytes -> base64 (chunked)
    const toBase64 = (bytes: Uint8Array): string => {
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[]);
      }
      return btoa(binary);
    };

    // Original signed contract template (private storage — fetched via service role)
    let originalPdfBase64: string | null = null;
    try {
      const adminSb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: file, error: dlErr } = await adminSb.storage.from("contracts").download("zmluva-original-2026.pdf");
      if (dlErr || !file) {
        console.error("Original contract download failed", dlErr);
      } else {
        originalPdfBase64 = toBase64(new Uint8Array(await file.arrayBuffer()));
      }
    } catch (e) {
      console.error("Original contract fetch error", e);
    }

    if (!originalPdfBase64) {
      return new Response(
        JSON.stringify({ error: "Originálnu zmluvu sa nepodarilo načítať" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const html = buildHtml(data.name, monthly);
    const text = buildText(data.name, monthly);

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
        subject: "Potvrdenie objednávky a návrh zmluvy – Web na prenájom",
        html,
        text,
        attachments: [
          {
            filename: "zmluva-original-2026.pdf",
            content: originalPdfBase64,
          },
        ],
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

    console.log("Order email sent", { resend_id: resendResult.id, to: data.email, amount: monthly });
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
