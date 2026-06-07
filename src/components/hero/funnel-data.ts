// ═══ HERO FUNNEL DATA ═══

export type Goal = "earn" | "customers" | "fix";

// ── Step 1: Goals ──
export const GOALS = [
  { id: "earn" as Goal, label: "Chcem začať zarábať", desc: "Hľadám spôsob, ako zarobiť online", emoji: "💰" },
  { id: "customers" as Goal, label: "Chcem viac zákazníkov", desc: "Podnikám, ale zákazníci ma nenachádzajú", emoji: "📈" },
  { id: "fix" as Goal, label: "Môj web nefunguje", desc: "Mám web, ale neprináša výsledky", emoji: "🔧" },
] as const;

// ── Step 2: Dynamic sub-options per goal ──
export const GOAL_OPTIONS: Record<Goal, { id: string; label: string; desc: string; emoji: string }[]> = {
  earn: [
    { id: "sell-services", label: "Predávať služby", desc: "Poradenstvo, koučing, konzultácie, fotenie...", emoji: "🤝" },
    { id: "sell-digital", label: "Predávať digitálny produkt", desc: "Online kurzy, e-booky, šablóny, recepty...", emoji: "📱" },
    { id: "collect-leads", label: "Zbierať kontakty", desc: "Získať e-maily a dopyty od záujemcov", emoji: "📋" },
  ],
  customers: [
    { id: "more-inquiries", label: "Viac dopytov", desc: "Zákazníci ma nenachádzajú alebo nepíšu", emoji: "📩" },
    { id: "better-presentation", label: "Lepšia prezentácia", desc: "Chcem vyzerať profesionálne a dôveryhodne", emoji: "✨" },
    { id: "more-trust", label: "Väčšia dôvera", desc: "Chcem budovať značku a získať dôveru", emoji: "🛡️" },
  ],
  fix: [
    { id: "no-customers", label: "Nemám zákazníkov", desc: "Web mám, ale nikto nekupuje ani nepíše", emoji: "😔" },
    { id: "outdated-design", label: "Zastaraný dizajn", desc: "Web vyzerá neaktuálne a nefunguje na mobile", emoji: "🎨" },
    { id: "poor-results", label: "Slabé výsledky", desc: "Web neprináša to, čo som očakával", emoji: "📉" },
  ],
};

// ── Step 3: Urgency ──
export const URGENCY_OPTIONS = [
  { id: "asap", label: "Okamžite", desc: "Chcem spustiť čo najskôr", emoji: "⚡" },
  { id: "weeks", label: "O pár týždňov", desc: "Mám čas na plánovanie", emoji: "📅" },
  { id: "exploring", label: "Len sa rozhliadam", desc: "Zatiaľ zisťujem možnosti", emoji: "🔍" },
] as const;

// ── Step 4: What's included ──
export const INCLUDED_FEATURES = [
  { label: "Navrhneme vám web", emoji: "🎨" },
  { label: "Vytvoríme obsah pomocou AI", emoji: "✍️" },
  { label: "Postaráme sa o hosting", emoji: "🌐" },
  { label: "Nastavíme firemný e-mail", emoji: "📧" },
  { label: "Zabezpečíme technickú správu", emoji: "🛠️" },
  { label: "Pripravíme web pre Google", emoji: "🔍" },
  { label: "SSL bezpečnostný certifikát", emoji: "🔒" },
  { label: "Mobilná responzivita", emoji: "📱" },
];

export const AGENCY_COMPARISON = [
  { feature: "Vstupné náklady", agency: "Drahé (1 500 €+)", us: "0 € — len mesačne" },
  { feature: "Dodanie", agency: "Trvá týždne", us: "Hotové do 48h" },
  { feature: "Zmeny a úpravy", agency: "Platené zvlášť", us: "V cene" },
  { feature: "Technické starosti", agency: "Riešite vy", us: "Riešime my" },
  { feature: "SEO optimalizácia", agency: "Príplatok", us: "V cene" },
];

// ── Step 5: Packages ──
export const PACKAGES = [
  {
    id: "start",
    name: "START",
    price: 35,
    discountedPrice: 30,
    desc: "Na rýchle spustenie a otestovanie nápadu",
    features: ["1 predajná stránka", "Mobilná verzia", "Kontaktný formulár", "Základné SEO", "SSL certifikát", "Technická správa"],
    recommended: false,
    emoji: "🚀",
  },
  {
    id: "business",
    name: "BUSINESS",
    price: 49,
    discountedPrice: 42,
    desc: "Na vybudovanie profesionálneho a dôveryhodného webu",
    features: ["Až 7 podstránok", "Pokročilé SEO", "Blog / aktuality", "Google Analytics", "Správa obsahu (CMS)", "Predajné texty", "Sociálne siete", "Technická správa"],
    recommended: true,
    emoji: "🌐",
  },
  {
    id: "pro",
    name: "PRO",
    price: 69,
    discountedPrice: 59,
    desc: "Na získavanie zákazníkov a rast biznisu",
    features: ["Neobmedzené podstránky", "E-shop / rezervácie / platby", "Vlastný admin panel", "Pokročilá analytika", "API integrácie", "A/B testovanie", "Prioritná podpora", "Všetko z BUSINESS"],
    recommended: false,
    emoji: "⚡",
  },
] as const;

// ── Package recommendation per goal ──
export const RECOMMENDED_PACKAGE: Record<Goal, string> = {
  earn: "pro",
  customers: "business",
  fix: "business",
};

export const RECOMMENDATION_REASONS: Record<Goal, string[]> = {
  earn: [
    "Zodpovedá vášmu cieľu zarábať online",
    "Vyžaduje minimálne úsilie z vašej strany",
    "Optimalizovaný na maximálne výsledky",
  ],
  customers: [
    "Zodpovedá vašej potrebe získať viac zákazníkov",
    "Vyžaduje minimálne úsilie z vašej strany",
    "Optimalizovaný na priťahovanie dopytov",
  ],
  fix: [
    "Zodpovedá vašej potrebe opraviť web",
    "Vyžaduje minimálne úsilie z vašej strany",
    "Optimalizovaný na lepší výkon",
  ],
};

// ── Billing ──
export const BILLING_INFO = {
  company: "Salelogics Group s. r. o.",
  iban: "SK18 1100 0000 0029 4829 2385",
  swift: "TATRSKBX",
} as const;

export const generateVariableSymbol = () => {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
};

// ── Calendar ──
export const TIME_SLOTS = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"];

export const getAvailableSlots = () => {
  const slots: { date: Date; label: string }[] = [];
  const now = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    if (d.getDay() >= 1 && d.getDay() <= 5) {
      slots.push({ date: d, label: d.toLocaleDateString("sk-SK", { day: "numeric", month: "short", weekday: "short" }) });
    }
  }
  return slots;
};
