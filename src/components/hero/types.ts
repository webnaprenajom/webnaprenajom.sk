export type HeroStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type Motivation = "earn-extra" | "more-customers" | "redesign";
export type BusinessType = "services" | "products" | "education" | "company";

export interface HeroFunnelState {
  step: HeroStep;
  motivation: Motivation | null;
  businessType: BusinessType | null;
  webType: string;
  pages: string;
  features: Set<string>;
  selectedPackage: string;
}

export const MOTIVATIONS = [
  {
    id: "earn-extra" as Motivation,
    label: "Chcem začať zarábať popri práci",
    desc: "Hľadám spôsob, ako si privyrobiť online — z domu, z telefónu, vo voľnom čase",
    icon: "DollarSign",
  },
  {
    id: "more-customers" as Motivation,
    label: "Mám firmu / biznis, ale potrebujem viac zákazníkov",
    desc: "Podnikám, ale zákazníci ma nenachádzajú na internete a dopyt je slabý",
    icon: "TrendingUp",
  },
  {
    id: "redesign" as Motivation,
    label: "Mám web, ale vôbec mi nezarábal — potrebujem redizajn",
    desc: "Web mám, ale nevyzerá dobre, nefunguje na mobile alebo neprináša zákazníkov",
    icon: "Monitor",
  },
] as const;

export const BUSINESS_TYPES = [
  {
    id: "services" as BusinessType,
    label: "Služby a poradenstvo",
    desc: "Masáže, koučing, upratovanie, fotenie, účtovníctvo, právne služby...",
    icon: "Users",
  },
  {
    id: "products" as BusinessType,
    label: "Produkty (fyzické alebo cez internet)",
    desc: "Handmade výrobky, oblečenie, doplnky stravy, kozmetika...",
    icon: "ShoppingCart",
  },
  {
    id: "education" as BusinessType,
    label: "Vzdelávanie a online kurzy",
    desc: "Online kurz varenia, fitness program, e-book, šablóny, recepty...",
    icon: "BookOpen",
  },
  {
    id: "company" as BusinessType,
    label: "Prezentácia firmy",
    desc: "Mám firmu a potrebujem profesionálnu stránku, ktorá pritiahne zákazníkov",
    icon: "Building",
  },
] as const;

export const TRENDING_CATEGORIES = [
  {
    label: "Online kurzy a vzdelávanie",
    desc: "Nauč ľudí to, čo vieš — varenie, fitness, jazyky, marketing. Raz vytvoríš, predávaš opakovane.",
    icon: "BookOpen",
    badge: "🏆 #1 trend",
    badgeColor: "bg-primary/10 text-primary",
  },
  {
    label: "Poradenstvo a konzultácie",
    desc: "Účtovníctvo, koučing, výživa, právne rady — stačí tvoje skúsenosti a stránka, kde ťa ľudia nájdu.",
    icon: "Users",
    badge: "📈 Stále rastie",
    badgeColor: "bg-accent/10 text-accent-foreground",
  },
  {
    label: "E-shop a vlastné produkty",
    desc: "Handmade výrobky, doplnky stravy, oblečenie. S vlastnou predajnou stránkou máš väčšiu maržu.",
    icon: "ShoppingCart",
    badge: "🔥 Vysoké marže",
    badgeColor: "bg-destructive/10 text-destructive",
  },
  {
    label: "Digitálne produkty",
    desc: "E-booky, šablóny, plány, recepty v PDF. Nulové náklady na výrobu, neobmedzený predaj.",
    icon: "Monitor",
    badge: "🚀 Pasívny príjem",
    badgeColor: "bg-primary/10 text-primary",
  },
  {
    label: "Služby pre firmy",
    desc: "Grafika, texty, sociálne siete, fotenie. Firmy stále hľadajú šikovných ľudí a ochotne platia.",
    icon: "Building",
    badge: "🤝 Stabilný dopyt",
    badgeColor: "bg-secondary text-secondary-foreground",
  },
] as const;

export const EARNING_TIERS = [
  {
    level: "Začiatočník",
    hours: "2-5 hodín týždenne",
    range: "200 – 500 €/mes",
    desc: "Jednoduché služby, poradenstvo alebo predaj produktov cez vlastnú stránku",
    color: "text-primary",
  },
  {
    level: "Pokročilý",
    hours: "5-10 hodín týždenne",
    range: "500 – 2 000 €/mes",
    desc: "Vlastný online kurz, e-shop alebo konzultácie s pravidelnou klientelou",
    color: "text-primary",
  },
  {
    level: "Profík",
    hours: "Part-time / full-time",
    range: "2 000 – 10 000+ €/mes",
    desc: "Rozvinutý biznis s automatickým predajom, opakovanými zákazníkmi a pasívnym príjmom",
    color: "text-primary",
  },
] as const;

export const INCLUDED_FEATURES = [
  { label: "Stránka na internete", desc: "Profesionálna, rýchla, pekná — na počítači aj na mobile. Tvoja adresa na webe.", icon: "Globe" },
  { label: "Predajný systém", desc: "Stránka, ktorá návštevníkov premení na zákazníkov. Automaticky, bez volania a presviedčania.", icon: "Target" },
  { label: "Štatistiky a prehľady", desc: "Uvidíš, koľko ľudí prišlo, odkiaľ a čo ich zaujalo. Jednoduchý prehľad.", icon: "BarChart3" },
  { label: "Možnosť prijímať platby", desc: "Zákazníci ti môžu zaplatiť priamo cez stránku — kartou, prevodom alebo na faktúru.", icon: "CreditCard" },
  { label: "Texty a obsah stránky", desc: "Vymyslíme za teba texty, ktoré predávajú. Ty len potvrdíš a spustíme.", icon: "FileText" },
  { label: "Technická starostlivosť", desc: "Aktualizácie, zálohy, bezpečnosť — o nič sa nemusíš starať. Funguje to samo.", icon: "Shield" },
] as const;

export const UPSELL_ITEMS = [
  { label: "Logo a branding", price: 300, icon: "Palette" },
  { label: "SEO optimalizácia", price: 400, icon: "Search" },
  { label: "Predajné texty a obsah", price: 350, icon: "FileText" },
  { label: "Napojenie na sociálne siete", price: 150, icon: "Share2" },
  { label: "Analytika a štatistiky", price: 200, icon: "BarChart3" },
  { label: "Technická správa (ročne)", price: 500, icon: "Shield" },
] as const;

export const WEB_TYPES = [
  { id: "presentation", label: "Prezentácia", base: 400 },
  { id: "business", label: "Firemný web", base: 800 },
  { id: "eshop", label: "E-shop", base: 1200 },
] as const;

export const PAGE_OPTIONS = [
  { id: "1-3", label: "1–3", extra: 0 },
  { id: "4-7", label: "4–7", extra: 200 },
  { id: "8+", label: "8+", extra: 400 },
] as const;

export const FEATURES = [
  { id: "seo", label: "SEO", price: 200 },
  { id: "reservation", label: "Rezervačný systém", price: 300 },
] as const;

export const PACKAGES = [
  {
    id: "landing",
    name: "Landing page",
    price: 35,
    desc: "Jedna predajná stránka optimalizovaná na konverzie",
  },
  {
    id: "presentation",
    name: "Prezentačný web",
    price: 49,
    desc: "Kompletný web s podstránkami, SEO a správou obsahu",
  },
  {
    id: "webapp",
    name: "Web aplikácia",
    price: 69,
    desc: "Pokročilý web s rezerváciami, e-shopom alebo platbami",
  },
] as const;

export function calculatePrice(
  webType: string,
  pages: string,
  features: Set<string>
): number {
  const base = WEB_TYPES.find((w) => w.id === webType)?.base ?? 800;
  const pageExtra = PAGE_OPTIONS.find((p) => p.id === pages)?.extra ?? 0;
  const featureExtra = FEATURES.reduce(
    (sum, f) => (features.has(f.id) ? sum + f.price : sum),
    0
  );
  return base + pageExtra + featureExtra;
}
