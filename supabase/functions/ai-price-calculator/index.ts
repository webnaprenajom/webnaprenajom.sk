import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));

    // ---- Input validation (allowlists + length caps) ----
    const ALLOWED_WEBSITE_TYPES = new Set([
      "landing", "presentation", "webapp", "eshop", "portfolio", "blog", "booking",
    ]);
    const ALLOWED_FEATURES = new Set([
      "payments", "booking", "ecommerce", "chatbot", "crm", "multilang", "memberArea",
      "blog", "forms", "gallery", "seo", "analytics", "newsletter", "reviews",
      "calendar", "maps", "social", "contact", "faq", "testimonials",
    ]);
    const ALLOWED_BUSINESS = new Set([
      "services", "products", "education", "company", "restaurant", "freelancer", "agency", "other",
    ]);
    const ALLOWED_MODELS = new Set(["rental", "wordpress", "shoptet"]);
    const ALLOWED_ESHOP = new Set(["digital", "physical", "supplier"]);

    const sanitizeId = (v: unknown, allowed: Set<string>, fallback: string) =>
      typeof v === "string" && allowed.has(v) ? v : fallback;

    const websiteType = sanitizeId(body.websiteType, ALLOWED_WEBSITE_TYPES, "presentation");
    const model = sanitizeId(body.model, ALLOWED_MODELS, "rental");
    const eshopType = sanitizeId(body.eshopType, ALLOWED_ESHOP, "physical");
    const businessType = sanitizeId(body.businessType, ALLOWED_BUSINESS, "other");

    const rawFeatures: unknown = body.features;
    const features: string[] = Array.isArray(rawFeatures)
      ? (rawFeatures as unknown[])
          .filter((f): f is string => typeof f === "string" && ALLOWED_FEATURES.has(f))
          .slice(0, 20)
      : [];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    // ----- Pricing logic (deterministic, AI only formulates explanation) -----
    type Pkg = "landing" | "presentation" | "webapp";
    let recommendedPackage: Pkg = "presentation";
    const featCount = Array.isArray(features) ? features.length : 0;
    const advancedFeatures = ["payments", "booking", "ecommerce", "chatbot", "crm", "multilang", "memberArea"];
    const hasAdvanced = (features || []).some((f: string) => advancedFeatures.includes(f));

    if (websiteType === "eshop" || features?.includes("ecommerce")) recommendedPackage = "webapp";
    else if (hasAdvanced || featCount >= 6) recommendedPackage = "webapp";
    else if (websiteType === "landing" && featCount <= 3) recommendedPackage = "landing";
    else recommendedPackage = "presentation";

    let monthly = 35;
    if (recommendedPackage === "presentation") monthly = 49;
    if (recommendedPackage === "webapp") monthly = 69;

    // Orientational total (one-off) — used as crossed-out reference for rental
    const indicativeTotal = 350 + featCount * 80 + (hasAdvanced ? 250 : 0);

    // One-off pricing
    let oneOffPrice: number | null = null;
    let oneOffPlatform: string | null = null;
    if (model === "wordpress") {
      oneOffPlatform = "Web na mieru (WordPress / AI)";
      oneOffPrice = indicativeTotal;
    } else if (model === "shoptet") {
      if (eshopType === "digital") {
        oneOffPlatform = "Eshop pre digitálny produkt";
        oneOffPrice = 350 + featCount * 60 + (hasAdvanced ? 200 : 0);
      } else {
        oneOffPlatform = "Eshop s napojením dodávateľov (Shoptet)";
        oneOffPrice = 950 + featCount * 120 + (hasAdvanced ? 450 : 0);
      }
    }

    const systemPrompt = `Si predajný copywriter pre slovenskú firmu "Web na prenájom". Píš po slovensky, neformálne (tykaj), krátko, s nadšením. Žiadne klišé, žiadne emoji v texte (okrem prípadného "✨" v nadpise).`;

    const userPrompt = `Klient v kalkulačke vybral:
- Typ webu: ${websiteType}
- Typ biznisu: ${businessType || "neuvedené"}
- Funkcie (${featCount}): ${(features || []).join(", ") || "žiadne"}
- Model: ${model === "rental" ? "Prenájom (mesačný paušál)" : model === "wordpress" ? "Jednorazovo na WordPress" : "Jednorazovo Shoptet eshop"}
- Odporúčaný balík: ${recommendedPackage} ${model === "rental" ? `(${monthly}€/mesiac)` : ""}
${oneOffPrice ? `- Odhadovaná jednorazová cena: ${oneOffPrice}€ (${oneOffPlatform})` : ""}

Vygeneruj personalizované zhrnutie. Vráť JSON cez tool call.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "build_offer",
                description: "Build personalized offer summary",
                parameters: {
                  type: "object",
                  properties: {
                    headline: { type: "string", description: "max 10 slov" },
                    summary: { type: "string", description: "2-3 vety personalizovaného popisu rieš." },
                    benefits: {
                      type: "array",
                      items: { type: "string" },
                      description: "3 krátke benefity (max 8 slov)",
                    },
                    cta: { type: "string", description: "krátka výzva k akcii (max 12 slov)" },
                  },
                  required: ["headline", "summary", "benefits", "cta"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "build_offer" } },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const tool = data.choices?.[0]?.message?.tool_calls?.[0];
    const offer = tool ? JSON.parse(tool.function.arguments) : {
      headline: "Tvoja personalizovaná ponuka",
      summary: "Pripravili sme pre teba odporúčanie na základe tvojho výberu.",
      benefits: ["Rýchle spustenie", "Bez vstupných nákladov", "Vrátane úprav"],
      cta: "Rezervuj si konzultáciu zdarma.",
    };

    return new Response(
      JSON.stringify({
        recommendedPackage,
        monthly,
        oneOffPrice,
        oneOffPlatform,
        indicativeTotal,
        model,
        ...offer,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("ai-price-calculator error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
