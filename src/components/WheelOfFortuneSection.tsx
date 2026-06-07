import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, Mail, Gift, Copy, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Visual segments shown on the wheel — must match server PRIZES order
// Each segment gets its own vivid color for a fun, "wheel of fortune" look
const SEGMENTS = [
  { label: "5%",        color: "#FF6B6B", text: "#fff" }, // coral red
  { label: "Zajtra",    color: "#94A3B8", text: "#fff" }, // slate
  { label: "10%",       color: "#FFA94D", text: "#fff" }, // orange
  { label: "Nič",       color: "#64748B", text: "#fff" }, // dark slate
  { label: "15%",       color: "#4ECDC4", text: "#fff" }, // teal
  { label: "20%",       color: "#5B8DEF", text: "#fff" }, // blue
  { label: "Nič",       color: "#475569", text: "#fff" }, // gray
  { label: "30% 🎉",     color: "#FFD93D", text: "#1a1a1a" }, // gold
];

const SEG_COUNT = SEGMENTS.length;
const SEG_DEG = 360 / SEG_COUNT;

type SpinResult = {
  alreadyPlayed: boolean;
  prize: { label: string; value: number; coupon: string | null };
  prizeIndex?: number;
  nextSpinAt?: string;
};

const WheelOfFortuneSection = () => {
  const [email, setEmail] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState<string>("");
  const wheelRef = useRef<HTMLDivElement>(null);

  // Countdown for next spin (when alreadyPlayed)
  useEffect(() => {
    if (!result?.nextSpinAt) return;
    const tick = () => {
      const ms = new Date(result.nextSpinAt!).getTime() - Date.now();
      if (ms <= 0) {
        setCountdown("");
        return;
      }
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setCountdown(`${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [result?.nextSpinAt]);

  const handleSpin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (spinning) return;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Zadaj platný email");
      return;
    }

    setSpinning(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke<SpinResult>("wheel-spin", {
        body: { email: email.trim().toLowerCase(), language: "sk" },
      });
      if (error) throw error;
      if (!data) throw new Error("Žiadna odpoveď zo servera");

      // If already played -> just show their previous prize, snap wheel to it
      const idx = data.prizeIndex ?? findVisualIndexForPrize(data.prize);
      // Calculate target rotation: pointer is at top (12 o'clock).
      // Each segment center is at (idx * SEG_DEG + SEG_DEG/2) in wheel coords.
      // We rotate wheel so segment center aligns to top => rotation = -(idx*SEG_DEG + SEG_DEG/2) mod 360
      const targetSegmentAngle = idx * SEG_DEG + SEG_DEG / 2;
      const baseTurns = data.alreadyPlayed ? 0 : 6; // multiple spins for animation
      const finalRotation =
        rotation + (baseTurns * 360) + ((360 - (((rotation % 360) + targetSegmentAngle) % 360)) % 360);

      setRotation(finalRotation);

      // Wait for wheel animation
      const animMs = data.alreadyPlayed ? 0 : 4500;
      setTimeout(() => {
        setResult(data);
        setSpinning(false);
      }, animMs);
    } catch (err: any) {
      console.error(err);
      toast.error("Niečo sa pokazilo", { description: err?.message });
      setSpinning(false);
    }
  };

  const findVisualIndexForPrize = (p: SpinResult["prize"]): number => {
    // Map prize.value -> segment index (matches server PRIZES order)
    if (p.value === 5) return 0;
    if (p.value === 0 && p.label.toLowerCase().includes("zajtra")) return 1;
    if (p.value === 10) return 2;
    if (p.value === 0 && p.label.toLowerCase().includes("bohužiaľ")) return 3;
    if (p.value === 15) return 4;
    if (p.value === 20) return 5;
    if (p.value === 0) return 6;
    if (p.value === 30) return 7;
    return 0;
  };

  const copyCoupon = async () => {
    if (!result?.prize.coupon) return;
    await navigator.clipboard.writeText(result.prize.coupon);
    setCopied(true);
    toast.success("Kupón skopírovaný");
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    setResult(null);
    setEmail("");
    setRotation(0);
  };

  return (
    <section className="py-20 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-accent/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="container mx-auto px-4 max-w-5xl relative z-10">
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium border border-primary/30 text-primary mb-6">
            <Gift className="w-4 h-4" />
            Bonus pre teba
          </span>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Zatoč kolesom šťastia a vyhraj{" "}
            <span className="text-gradient">až 30% zľavu</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Jedno točenie denne. Vyhratú zľavu si môžeš uplatniť pri objednávke ľubovoľnej služby.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-10 items-center">
          {/* Wheel */}
          <div className="flex justify-center">
            <div className="relative w-[320px] h-[320px] sm:w-[400px] sm:h-[400px]">
              {/* Outer glow ring */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/40 via-accent/30 to-primary/40 blur-2xl opacity-60" />

              {/* Outer decorative ring */}
              <div className="absolute -inset-3 rounded-full border-4 border-primary/30 shadow-[0_0_40px_hsl(var(--primary)/0.3)]" />

              {/* Pointer (top) */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-20">
                <div
                  className="w-0 h-0 border-l-[16px] border-r-[16px] border-t-[28px] border-l-transparent border-r-transparent drop-shadow-[0_4px_8px_hsl(var(--primary)/0.5)]"
                  style={{ borderTopColor: "hsl(var(--primary))" }}
                />
              </div>

              {/* Wheel SVG */}
              <motion.div
                ref={wheelRef}
                className="absolute inset-0 rounded-full overflow-hidden border-4 border-background shadow-2xl"
                animate={{ rotate: rotation }}
                transition={{ duration: spinning ? 4.5 : 0, ease: [0.17, 0.67, 0.21, 0.99] }}
              >
                <svg viewBox="0 0 200 200" className="w-full h-full">
                  {SEGMENTS.map((seg, i) => {
                    const startAngle = i * SEG_DEG - 90; // start at top
                    const endAngle = startAngle + SEG_DEG;
                    const startRad = (startAngle * Math.PI) / 180;
                    const endRad = (endAngle * Math.PI) / 180;
                    const x1 = 100 + 100 * Math.cos(startRad);
                    const y1 = 100 + 100 * Math.sin(startRad);
                    const x2 = 100 + 100 * Math.cos(endRad);
                    const y2 = 100 + 100 * Math.sin(endRad);
                    const path = `M100,100 L${x1},${y1} A100,100 0 0,1 ${x2},${y2} Z`;
                    // Text position
                    const midAngle = startAngle + SEG_DEG / 2;
                    const midRad = (midAngle * Math.PI) / 180;
                    const tx = 100 + 58 * Math.cos(midRad);
                    const ty = 100 + 58 * Math.sin(midRad);
                    return (
                      <g key={i}>
                        <path
                          d={path}
                          fill={seg.color}
                          stroke="hsl(var(--background))"
                          strokeWidth="1.5"
                        />
                        <text
                          x={tx}
                          y={ty}
                          fill={seg.text}
                          fontSize="7.5"
                          fontWeight="bold"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          transform={`rotate(${midAngle + 90} ${tx} ${ty})`}
                          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
                        >
                          {seg.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </motion.div>

              {/* Center hub */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-primary border-4 border-background shadow-lg flex items-center justify-center z-10">
                <Sparkles className="w-6 h-6 text-primary-foreground" />
              </div>
            </div>
          </div>

          {/* Form / Result */}
          <div className="rounded-3xl border border-primary/20 bg-card/60 backdrop-blur-sm p-6 sm:p-8 shadow-xl">
            {!result && (
              <form onSubmit={handleSpin} className="space-y-5">
                <div>
                  <h3 className="text-xl font-bold mb-2">Zadaj svoj email a zatoč</h3>
                  <p className="text-sm text-muted-foreground">
                    Pošleme ti tvoj kupón na email aby si naň nezabudol.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wheel-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="wheel-email"
                      type="email"
                      placeholder="ty@firma.sk"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      maxLength={255}
                      disabled={spinning}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  variant="gradient"
                  size="lg"
                  className="w-full"
                  disabled={spinning}
                >
                  <Sparkles className="w-5 h-5" />
                  {spinning ? "Točí sa..." : "Zatočiť kolesom"}
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">
                  1 točenie / email / 24 hodín · Zľava platí na všetky naše služby
                </p>
              </form>
            )}

            {result && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-5"
              >
                {result.alreadyPlayed ? (
                  <>
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                      <Clock className="w-5 h-5" />
                      <span className="text-sm font-semibold uppercase tracking-wider">
                        Dnes si už točil
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold">
                      Tvoja predošlá výhra: <span className="text-primary">{result.prize.label}</span>
                    </h3>
                    {result.prize.coupon ? (
                      <>
                        <div className="rounded-xl bg-primary/10 border border-primary/30 p-4 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Tvoj kupón</div>
                            <div className="text-lg font-bold text-primary tracking-wider">
                              {result.prize.coupon}
                            </div>
                          </div>
                          <Button variant="outline" size="sm" onClick={copyCoupon}>
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Kupón uplatníš pri objednávke ľubovoľnej služby — stačí ho uviesť v poznámke.
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Tentokrát to nevyšlo, ale skús to znova zajtra! 🍀
                      </p>
                    )}
                    {countdown && (
                      <div className="text-sm text-muted-foreground">
                        Ďalšie točenie o: <strong className="text-foreground">{countdown}</strong>
                      </div>
                    )}
                  </>
                ) : result.prize.value > 0 ? (
                  <>
                    <div className="flex items-center gap-2 text-primary">
                      <Sparkles className="w-5 h-5" />
                      <span className="text-sm font-semibold uppercase tracking-wider">
                        Gratulujeme!
                      </span>
                    </div>
                    <h3 className="text-3xl font-bold">
                      Vyhral si <span className="text-gradient">{result.prize.label}</span>
                    </h3>
                    <div className="rounded-xl bg-primary/10 border border-primary/30 p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground mb-1">Tvoj kupón</div>
                        <div className="text-lg font-bold text-primary tracking-wider truncate">
                          {result.prize.coupon}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={copyCoupon}>
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Kupón uplatníš pri objednávke ľubovoľnej našej služby — stačí ho uviesť v poznámke pri dopyte.
                    </p>
                    <Button
                      variant="gradient"
                      size="lg"
                      className="w-full"
                      onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent("open-offer-redeem", {
                            detail: { code: result.prize.coupon },
                          }),
                        );
                      }}
                    >
                      Uplatniť zľavu a poslať dopyt
                    </Button>
                    <button
                      type="button"
                      onClick={reset}
                      className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Zavrieť
                    </button>
                  </>
                ) : (
                  <>
                    <h3 className="text-2xl font-bold">{result.prize.label} 🍀</h3>
                    <p className="text-muted-foreground">
                      Tentokrát to nevyšlo, ale nezúfaj — skús to znova zajtra. Šťastie sa otáča rýchlo!
                    </p>
                    <Button variant="outline" className="w-full" onClick={reset}>
                      Rozumiem
                    </Button>
                  </>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default WheelOfFortuneSection;
