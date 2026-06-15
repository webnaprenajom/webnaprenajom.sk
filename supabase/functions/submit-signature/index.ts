import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function s(v: unknown, max = 500): string {
  return String(v ?? "").trim().slice(0, max);
}
function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 255;
}

const PLANS = new Set(["rental", "annual", "oneoff"]);
const PACKAGES = new Set(["start", "biznis", "pro", "custom"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));

    const client_name = s(body?.client_name, 150);
    const email = s(body?.email, 255).toLowerCase();
    const phone = s(body?.phone, 40);
    const company = s(body?.company, 200);
    const ico = s(body?.ico, 30);
    const dic = s(body?.dic, 30);
    const address = s(body?.address, 300);
    const plan = PLANS.has(s(body?.plan, 20)) ? s(body?.plan, 20) : "rental";
    const package_name = PACKAGES.has(s(body?.package_name, 20)) ? s(body?.package_name, 20) : "start";
    const price = Math.max(0, Math.min(99999, Number(body?.price) || 0));
    const contract_months = Math.max(1, Math.min(60, Number(body?.contract_months) || 12));
    const signature_name = s(body?.signature_name, 150);
    const agreed_terms = body?.agreed_terms === true;
    const notes = s(body?.notes, 1000);

    if (!client_name || !signature_name) {
      return new Response(JSON.stringify({ error: "Vyplňte meno a podpis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!isValidEmail(email)) {
      return new Response(JSON.stringify({ error: "Neplatný email" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!agreed_terms) {
      return new Response(JSON.stringify({ error: "Musíte súhlasiť s podmienkami" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Capture client IP
    const ipHeader = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "";
    const ip_address = ipHeader.split(",")[0].trim().slice(0, 100) || null;
    const user_agent = (req.headers.get("user-agent") || "").slice(0, 500);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("order_signatures")
      .insert({
        client_name, email, phone, company, ico, dic, address,
        plan, package_name, price, contract_months,
        signature_name, agreed_terms, notes,
        ip_address, user_agent,
      })
      .select("id")
      .single();

    if (error) {
      console.error("submit-signature insert error", error);
      return new Response(JSON.stringify({ error: "Uloženie zlyhalo" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("submit-signature error", e);
    return new Response(JSON.stringify({ error: "Neočakávaná chyba" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
