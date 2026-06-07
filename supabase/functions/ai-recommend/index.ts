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

    const motivationMap: Record<string, string> = {
      "earn-extra": "chce si privyrobiť popri práci",
      "start-business": "chce začať vlastný biznis",
      "more-customers": "už podniká, ale chce viac zákazníkov",
      "fresh-start": "chce zmenu a nový začiatok",
      "redesign": "má web, ale potrebuje redizajn",
    };

    const businessMap: Record<string, string> = {
      services: "ponúka služby a poradenstvo",
      products: "predáva produkty (fyzické alebo online)",
      education: "vzdeláva alebo predáva online kurzy",
      company: "potrebuje prezentáciu firmy",
    };

    // Strict allowlist — reject unknown values (no raw passthrough into prompt)
    const motivation = typeof body.motivation === "string" && motivationMap[body.motivation]
      ? body.motivation : "more-customers";
    const businessType = typeof body.businessType === "string" && businessMap[body.businessType]
      ? body.businessType : "services";

    const motivDesc = motivationMap[motivation];
    const bizDesc = businessMap[businessType];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Si skúsený predajný copywriter pre slovenskú firmu "Web na prenájom", ktorá ponúka prenájom webstránok za mesačný poplatok (35€, 49€, 69€/mes). Tvoja úloha je na základe odpovedí z kvízu vygenerovať personalizované odporúčanie balíka.

Máme 3 balíky:
- "landing" (35€/mes): Landing page – jedna predajná stránka optimalizovaná na konverzie. Ideálna pre jednoduchý biznis.
- "presentation" (49€/mes): Prezentačný web – kompletný web s podstránkami, SEO a správou obsahu. Najlepší pomer cena/výkon.
- "webapp" (69€/mes): Web aplikácia – pokročilý web s rezerváciami, e-shopom alebo platbami. Pre náročnejších.

Tri segmenty používateľov:
1. PRESVEDČIŤ – neistí, skeptickí, váhajúci → motivuj ich, ukáž im prečo je to jednoduché, bezrizikové
2. NAVIGOVAŤ (vedia čo chcú) – podnikatelia so skúsenosťami → potvr0 ich rozhodnutie, buď konkrétny
3. NAVIGOVAŤ (nevedia čo chcú) – nováčikovia → vysvetli im jednoducho, drž ich za ruku

DÔLEŽITÉ: Píš po slovensky, neformálne (tykaj), krátko a presvedčivo. Žiadne klišé.`;

    const userPrompt = `Používateľ v kvíze odpovedal:
- Motivácia: ${motivDesc}
- Typ biznisu: ${bizDesc}

Vygeneruj JSON s týmito poľami:
- "recommendedPackage": id balíka ("landing", "presentation", alebo "webapp")
- "headline": krátky personalizovaný nadpis (max 10 slov) – prečo je tento balík pre neho
- "reason": 1-2 vety prečo je práve tento balík ideálny pre jeho situáciu  
- "benefits": pole 3 krátkych výhod prispôsobených jeho biznisu (max 8 slov každá)
- "urgency": krátka veta vytvárajúca pocit naliehavosti (max 15 slov)
- "segment": "convince" | "navigate-decided" | "navigate-undecided"

Vrať LEN platný JSON, nič iné.`;

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
                name: "recommend_package",
                description:
                  "Return a personalized package recommendation for the user.",
                parameters: {
                  type: "object",
                  properties: {
                    recommendedPackage: {
                      type: "string",
                      enum: ["landing", "presentation", "webapp"],
                    },
                    headline: { type: "string" },
                    reason: { type: "string" },
                    benefits: {
                      type: "array",
                      items: { type: "string" },
                    },
                    urgency: { type: "string" },
                    segment: {
                      type: "string",
                      enum: [
                        "convince",
                        "navigate-decided",
                        "navigate-undecided",
                      ],
                    },
                  },
                  required: [
                    "recommendedPackage",
                    "headline",
                    "reason",
                    "benefits",
                    "urgency",
                    "segment",
                  ],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "recommend_package" },
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call in AI response");
    }

    const recommendation = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(recommendation), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-recommend error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
