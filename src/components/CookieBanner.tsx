import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Cookie, X } from "lucide-react";

const STORAGE_KEY = "cookie-consent-dismissed-at";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const CookieBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const last = raw ? parseInt(raw, 10) : 0;
      if (!last || Date.now() - last > ONE_DAY_MS) {
        const t = setTimeout(() => setVisible(true), 800);
        return () => clearTimeout(t);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  const dismiss = (accepted: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
      localStorage.setItem("cookie-consent", accepted ? "accepted" : "rejected");
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookies"
      className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4 pointer-events-none"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
    >
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-2xl border border-border/60 bg-background/95 backdrop-blur-xl shadow-2xl p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="hidden sm:flex w-10 h-10 rounded-full bg-primary/10 items-center justify-center flex-shrink-0">
            <Cookie className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-foreground text-sm sm:text-base">
                Používame cookies
              </h3>
              <button
                onClick={() => dismiss(false)}
                aria-label="Zavrieť"
                className="text-muted-foreground hover:text-foreground transition-colors -mt-1 -mr-1 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
              Tento web používa cookies na zlepšenie používateľského zážitku, analýzu návštevnosti a personalizáciu obsahu. Pokračovaním v prehliadaní súhlasíte s ich používaním v súlade s GDPR.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Button size="sm" variant="gradient" onClick={() => dismiss(true)}>
                Prijať všetky
              </Button>
              <Button size="sm" variant="outline" onClick={() => dismiss(false)}>
                Iba nevyhnutné
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;
