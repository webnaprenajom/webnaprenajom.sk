import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useOnlineVisitors } from "@/hooks/useOnlineVisitors";

const FooterSectionLocalized = () => {
  const { lang, t } = useLanguage();
  const onlineCount = useOnlineVisitors();

  return (
    <footer className="border-t border-border/50 py-10 bg-card/30">
      <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="font-heading font-bold text-lg">
          <span className="text-gradient">{t.footer.brand}</span>{t.footer.brandSuffix}
        </p>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            <span>{onlineCount} online</span>
          </span>
          <span className="w-px h-5 bg-border/50" />
          <span className="text-xs text-muted-foreground mr-1">{t.footer.language}</span>
          <Link to="/" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition-all text-sm font-medium ${lang === "sk" ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:border-primary/50 hover:bg-primary/5"}`}>
            <img src="https://flagcdn.com/w20/sk.png" alt="SK" className="w-5 h-auto rounded-sm" />
            SK
          </Link>
          <Link to="/en" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition-all text-sm font-medium ${lang === "en" ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:border-primary/50 hover:bg-primary/5"}`}>
            <img src="https://flagcdn.com/w20/gb.png" alt="EN" className="w-5 h-auto rounded-sm" />
            EN
          </Link>
          <Link to="/de" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition-all text-sm font-medium ${lang === "de" ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:border-primary/50 hover:bg-primary/5"}`}>
            <img src="https://flagcdn.com/w20/de.png" alt="DE" className="w-5 h-auto rounded-sm" />
            DE
          </Link>
        </div>
        <p className="text-muted-foreground text-sm">
          © {new Date().getFullYear()} {t.footer.brand}{t.footer.brandSuffix}. {t.footer.rights}
        </p>
      </div>
    </footer>
  );
};

export default FooterSectionLocalized;
