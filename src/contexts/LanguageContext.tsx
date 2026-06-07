import { createContext, useContext, ReactNode } from "react";
import { Language, getTranslation, translations } from "@/i18n/translations";

type TranslationType = typeof translations.sk;

interface LanguageContextType {
  lang: Language;
  t: TranslationType;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ lang, children }: { lang: Language; children: ReactNode }) => {
  const t = getTranslation(lang);
  return (
    <LanguageContext.Provider value={{ lang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
