import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Prize = {
  id: string;
  label: string;
  value: number; // % discount, 0 = nothing
  weight: number; // probability weight
};

const PRIZES: Prize[] = [
  { id: "p5", label: "5% zľava", value: 5, weight: 26 },
  { id: "none1", label: "Skúšaj zajtra znova", value: 0, weight: 22 },
  { id: "p10", label: "10% zľava", value: 10, weight: 18 },
  { id: "none2", label: "Bohužiaľ nič", value: 0, weight: 14 },
  { id: "p15", label: "15% zľava", value: 15, weight: 10 },
  { id: "p20", label: "20% zľava", value: 20, weight: 6 },
  { id: "none3", label: "Tentokrát nie", value: 0, weight: 3 },
  { id: "p30", label: "30% zľava 🎉", value: 30, weight: 1 },
];

function pickPrize(): Prize {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of PRIZES) {
    if ((r -= p.weight) <= 0) return p;
  }
  return PRIZES[0];
}

function generateCoupon(value: number): string {
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `WIN${value}-${rand}`;
}

function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 255;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const language = String(body?.language || "sk");

    if (!isValidEmail(email)) {
      return new Response(
        JSON.stringify({ error: "Neplatný email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Check 24h limit
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existing, error: selErr } = await supabase
      .from("wheel_spins")
      .select("id, prize_label, prize_value, coupon_code, created_at")
      .eq("email", email)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1);

    if (selErr) throw selErr;

    if (existing && existing.length > 0) {
      const last = existing[0];
      const next = new Date(new Date(last.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString();
      return new Response(
        JSON.stringify({
          alreadyPlayed: true,
          prize: {
            label: last.prize_label,
            value: last.prize_value,
            coupon: last.coupon_code,
          },
          nextSpinAt: next,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Pick prize and pre-compute index for client animation
    const prize = pickPrize();
    const prizeIndex = PRIZES.findIndex((p) => p.id === prize.id);
    const coupon = prize.value > 0 ? generateCoupon(prize.value) : null;

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      null;

    const { error: insErr } = await supabase.from("wheel_spins").insert({
      email,
      prize_label: prize.label,
      prize_value: prize.value,
      coupon_code: coupon,
      language,
      ip_address: ip,
    });

    if (insErr) throw insErr;

    // Create admin notification
    const winText = prize.value > 0
      ? `Vyhral ${prize.value}% zľavu (${coupon})`
      : `Bez výhry: ${prize.label}`;
    await supabase.from("notifications").insert({
      type: "wheel_spin",
      title: `🎡 Točenie kolesom · ${email}`,
      message: winText,
      link: "/admin",
      metadata: {
        email,
        prize_label: prize.label,
        prize_value: prize.value,
        coupon_code: coupon,
        language,
      },
    });

    // Also log to lead_logs for unified audit trail
    await supabase.from("lead_logs").insert({
      action: "wheel_spin",
      lead_email: email,
      lead_name: null,
      field: "prize",
      new_value: `${prize.label}${coupon ? " · " + coupon : ""}`,
    });

    return new Response(
      JSON.stringify({
        alreadyPlayed: false,
        prize: { label: prize.label, value: prize.value, coupon },
        prizeIndex,
        prizes: PRIZES.map((p) => ({ id: p.id, label: p.label, value: p.value })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("wheel-spin error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
