import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import LeadFormDialogLocalized from "./LeadFormDialogLocalized";
import { useLanguage } from "@/contexts/LanguageContext";
import ThemeToggle from "@/components/ThemeToggle";

const StickyHeaderLocalized = () => {
  const { lang, t } = useLanguage();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 500);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ y: -80 }} animate={{ y: 0 }} exit={{ y: -80 }} className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
          <div className="container mx-auto px-4">
            {/* Row 1: Logo + langs (desktop) + CTA */}
            <div className="flex items-center justify-between h-14">
              <span className="font-heading font-bold text-lg whitespace-nowrap">
                <span className="text-gradient">{t.footer.brand}</span>{t.footer.brandSuffix}
              </span>
              <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center gap-1.5 mr-2">
                  <Link to="/" className={`flex items-center gap-1 px-2 py-1 rounded-md border transition-all text-xs font-medium ${lang === "sk" ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:border-primary/50 hover:bg-primary/5"}`}>
                    <img src="https://flagcdn.com/w20/sk.png" alt="SK" className="w-4 h-auto rounded-sm" />
                    SK
                  </Link>
                  <Link to="/en" className={`flex items-center gap-1 px-2 py-1 rounded-md border transition-all text-xs font-medium ${lang === "en" ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:border-primary/50 hover:bg-primary/5"}`}>
                    <img src="https://flagcdn.com/w20/gb.png" alt="EN" className="w-4 h-auto rounded-sm" />
                    EN
                  </Link>
                  <Link to="/de" className={`flex items-center gap-1 px-2 py-1 rounded-md border transition-all text-xs font-medium ${lang === "de" ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:border-primary/50 hover:bg-primary/5"}`}>
                    <img src="https://flagcdn.com/w20/de.png" alt="DE" className="w-4 h-auto rounded-sm" />
                    DE
                  </Link>
                </div>
                <span className="hidden md:block"><ThemeToggle /></span>
                <LeadFormDialogLocalized initialStep="inquiry">
                  <Button variant="gradient" size="sm" className="px-4 md:px-6 text-xs md:text-sm">{t.hero.ctaProposal}</Button>
                </LeadFormDialogLocalized>
              </div>
            </div>
            {/* Row 2: Language switcher (mobile only) */}
            <div className="flex md:hidden items-center justify-center gap-2 pb-2 -mt-1">
              <Link to="/" className={`flex items-center gap-1 px-2 py-1 rounded-md border transition-all text-xs font-medium ${lang === "sk" ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:border-primary/50 hover:bg-primary/5"}`}>
                <img src="https://flagcdn.com/w20/sk.png" alt="SK" className="w-4 h-auto rounded-sm" />
                SK
              </Link>
              <Link to="/en" className={`flex items-center gap-1 px-2 py-1 rounded-md border transition-all text-xs font-medium ${lang === "en" ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:border-primary/50 hover:bg-primary/5"}`}>
                <img src="https://flagcdn.com/w20/gb.png" alt="EN" className="w-4 h-auto rounded-sm" />
                EN
              </Link>
              <Link to="/de" className={`flex items-center gap-1 px-2 py-1 rounded-md border transition-all text-xs font-medium ${lang === "de" ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:border-primary/50 hover:bg-primary/5"}`}>
                <img src="https://flagcdn.com/w20/de.png" alt="DE" className="w-4 h-auto rounded-sm" />
                DE
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StickyHeaderLocalized;
