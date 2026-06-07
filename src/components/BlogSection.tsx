import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import {
  Brain, Zap, TrendingDown, ArrowRight, ArrowLeft, Calendar, Clock,
  Wallet, Bot, Sparkles, Shield, Smartphone, TrendingUp,
  Cpu, Headphones as HeadphonesIcon, Globe, DollarSign,
  Building2, FileText, Scale, Maximize2, Banknote, Workflow, Star,
} from "lucide-react";
import AnimatedSection from "./AnimatedSection";
import blogSpeed from "@/assets/blog-ai-speed.jpg";
import blogCost from "@/assets/blog-ai-cost.jpg";
import blogFeatures from "@/assets/blog-ai-features.jpg";
import blogRealEstate from "@/assets/blog-realestate-crm.png";
import blogLanding from "@/assets/blog-landing-leadgen.png";
import blogRentVsInvest from "@/assets/blog-rent-vs-invest.jpg";
import blogAiPossibilities from "@/assets/blog-ai-possibilities.jpg";
import blogProcess from "@/assets/blog-process-cooperation.jpg";

const benefitsMarquee = [
  { icon: Wallet, label: "0€ vstupné náklady" },
  { icon: Clock, label: "Web do 48 hodín" },
  { icon: Bot, label: "AI obsah zadarmo" },
  { icon: Sparkles, label: "Moderný dizajn" },
  { icon: Shield, label: "SSL & GDPR v cene" },
  { icon: Smartphone, label: "Plne responzívny" },
  { icon: TrendingUp, label: "SEO optimalizácia" },
  { icon: Cpu, label: "AI chatbot 24/7" },
  { icon: HeadphonesIcon, label: "Podpora v cene" },
  { icon: Globe, label: "Multi-jazyčnosť" },
  { icon: DollarSign, label: "Od 35€/mesiac" },
  { icon: Zap, label: "Bleskovo rýchly" },
];

type Article = {
  id: string;
  icon: any;
  image: string;
  imageBg?: "default" | "white";
  category: string;
  title: string;
  excerpt: string;
  readTime: string;
  date: string;
  publishedAt: string; // ISO YYYY-MM-DD for sorting
  showFullPreviewLink?: boolean;
  hasCta?: boolean;
  hasProcessCta?: boolean;
  content: string[];
};

const articles: Article[] = ([
  {
    id: "process-cooperation",
    icon: Workflow,
    image: blogProcess,
    imageBg: "white",
    category: "Proces spolupráce",
    title: "Ako prebieha spolupráca: od výberu riešenia po web na doméne za 48 hodín",
    excerpt:
      "Vyberieš si riešenie, pošleš podklady, my dizajnujeme a nasadíme. Kompletne v cene mesačného paušálu — bez vstupných nákladov.",
    readTime: "5 min",
    date: "Máj 2026",
    publishedAt: "2026-05-28",
    hasProcessCta: true,
    content: [
      "Spolupráca s nami je rovnako jednoduchá ako celé naše riešenie. Žiadne dlhé brífingy, žiadne komplikované zmluvy. Tu je presný postup, ktorým prejdeš od prvého kontaktu po hotový web online.",
      "1. Výber riešenia. Najprv si spolu povieme, čo presne potrebuješ. Máme tri hlavné smery: landing page na zber dopytov (ideálne pre kampane a lead generation), firemný web (prezentácia firmy, služieb a referencií) alebo komplexné CRM riešenie postavené pod firemným webom — na manažovanie klientov, dopytov a obchodov na jednom mieste.",
      "2. Zaslanie podkladov. Pošleš nám svoje požiadavky — texty, logo, fotky, prípadné inšpirácie. Ak nemáš všetko po ruke, nevadí. Texty aj základnú vizuálnu identitu vieme pripraviť pomocou AI v rámci paušálu zdarma.",
      "3. Spracovanie zadania a dizajn. Tvoje zadanie spracujeme, pripravíme architektúru webu a pustíme sa do dizajnovania riešenia presne podľa tvojej značky a cieľov.",
      "4. Spustenie do 48 hodín. Ak máme komplet podklady, celé riešenie postavíme a nasadíme na doménu do 48 hodín. Áno, čítaš správne — dva dni a tvoj web je online.",
      "Čo všetko je v cene mesačného paušálu? Kompletná tvorba dizajnu podľa tvojich požiadaviek, nastavenie e-mailových schránok, hosting, SSL certifikát a zabezpečenie, mesačná správa a úpravy obsahu na stránke. Web je z používateľského hľadiska úplne bez údržby — o všetko sa staráme my.",
      "Aby sme na tom neprerobili, najnižšia možná viazanosť je 6 mesiacov. Po tomto období pokračuješ ďalej mesiac po mesiaci, alebo môžeš spoluprácu kedykoľvek ukončiť bez akýchkoľvek poplatkov.",
    ],
  },
  {
    id: "earn-online",
    icon: Banknote,
    image: blogAiPossibilities,
    imageBg: "white",
    category: "Zarábanie online",
    title: "Ako zarábať na internete: digitálne produkty, ktoré vieš spustiť za týždeň",
    excerpt:
      "E-booky, kurzy, šablóny, členské sekcie alebo SaaS nástroje. S našou službou rozbehneš digitálny biznis bez vstupných nákladov.",
    readTime: "6 min",
    date: "Máj 2026",
    publishedAt: "2026-05-25",
    hasCta: true,
    content: [
      "Zarábať online dnes neznamená čakať mesiace na vývoj webu alebo platiť tisíce eur za eshop. Najrýchlejšia cesta sú digitálne produkty — raz ich vytvoríš, predávaš ich opakovane a nemáš sklad ani logistiku.",
      "Tipy digitálnych produktov, ktoré vieme spustiť spolu s tebou: e-booky a PDF sprievodcovia (predaj cez landing page s automatickým doručením), online kurzy s členskou sekciou (video lekcie, kvízy, certifikáty), šablóny pre Notion / Canva / Excel, hudobné a grafické balíčky pre tvorcov.",
      "Pokročilejšie modely: predplatné na exkluzívny obsah (newsletter, video kanál, komunita), SaaS nástroj alebo mini-aplikácia (kalkulačka, generátor, AI asistent), affiliate landing pages s automatickým trackingom, digitálne služby s rezervačným systémom (konzultácie, koučing).",
      "Každý takýto produkt potrebuje to isté: rýchly predajný web, formulár, ktorý prepíše leady do CRM, automatický mail s prístupom alebo platobnú bránu. To celé vieme postaviť za pár dní v rámci paušálu od 35 € / mes — bez vstupných nákladov.",
      "Ak máš nápad a chceš zistiť, ako presne by to vyzeralo pre tvoj produkt, ozvi sa nám. Pripravíme ti konkrétny plán a orientačnú cenu zdarma.",
    ],
  },
  {
    id: "realestate-crm",
    icon: Building2,
    image: blogRealEstate,
    imageBg: "white",
    category: "Realitky",
    title: "Webstránky pre realitky a inzertné portály s vlastným CRM",
    excerpt:
      "Maklér nahrá fotky drag & drop, vyplní formulár a inzerát je online. CRM si pamätá každý dopyt, klienta aj fázu jednania.",
    readTime: "5 min",
    date: "Máj 2026",
    publishedAt: "2026-05-20",
    showFullPreviewLink: true,
    content: [
      "Klasická realitná stránka je dnes málo. Maklér potrebuje viac ako len online katalóg — potrebuje nástroj, ktorý mu šetrí hodiny denne. Práve preto staviame realitné weby spolu s vlastným adminom a CRM systémom na mieru.",
      "Maklér nahrá fotky cez drag & drop, vyplní jednoduchý formulár (lokalita, cena, dispozícia, energetický štítok) a inzerát sa okamžite zverejní na webe. Voliteľne aj na partnerských portáloch cez API. Každú nehnuteľnosť je možné upraviť, zarchivovať alebo označiť ako rezervovanú jedným klikom.",
      "Vstavané CRM zachytáva každý dopyt z webu — meno, telefón, ktorá nehnuteľnosť, odkiaľ prišiel. Maklér v ňom vidí celú históriu komunikácie, plánuje obhliadky, eviduje provízie a má prehľad o tom, ktorý lead je najbližšie k podpisu.",
      "Pre realitnú kanceláriu to znamená menej Excelu, menej zabudnutých klientov a viac uzavretých obchodov. A keďže ide o web na prenájom, štart je za 0 € a všetky úpravy a nové funkcie sú v cene paušálu.",
    ],
  },
  {
    id: "landing-leadgen",
    icon: FileText,
    image: blogLanding,
    imageBg: "white",
    category: "Lead generation",
    title: "Landing page pre zber dopytov: prečo je inteligentný formulár základ",
    excerpt:
      "Landing page bez inteligentného formulára je len letáčik. Ten správny formulár prepíše každý lead rovno do CRM aj Google Sheetu.",
    readTime: "4 min",
    date: "Máj 2026",
    publishedAt: "2026-05-18",
    content: [
      "Landing page má jediný cieľ — premeniť návštevníka na lead. Pekný dizajn a silný headline sú len polovica práce. Druhá polovica je formulár — a presne tu väčšina firiem stráca peniaze.",
      "Klasický statický formulár pošle email a tým to končí. My staviame inteligentné formuláre, ktoré sa prispôsobujú návštevníkovi: pýtajú sa postupne, preskočia nerelevantné kroky a vďaka segmentácii zistia, či ide o vážneho záujemcu alebo iba okoloidúceho.",
      "Každý odoslaný dopyt sa automaticky prepíše do CRM systému, do Google Sheetu pre tím a okamžite spustí notifikáciu na email aj WhatsApp. Žiadne kopírovanie z mailov, žiadne zabudnuté kontakty — celý proces beží sám.",
      "Pre kampane na Google Ads alebo Meta Ads je toto rozdiel medzi 2 % a 8 % konverziou. Inými slovami — 4× viac dopytov za rovnaký rozpočet. A pri prenájme webu od 35 € / mes to znamená, že landing sa zaplatí už z prvého klienta.",
    ],
  },
  {
    id: "rent-vs-invest",
    icon: Scale,
    image: blogRentVsInvest,
    imageBg: "white",
    category: "Porovnanie",
    title: "Web na prenájom vs. veľká investícia: čo sa naozaj oplatí",
    excerpt:
      "3 000 € jednorazovo a roky čakania na update — alebo 35 € mesačne s neustálym vývojom? Porovnanie bez marketingových rečí.",
    readTime: "5 min",
    date: "Máj 2026",
    publishedAt: "2026-05-15",
    content: [
      "Pri rozhodovaní medzi vlastným webom a prenájmom väčšina firiem počíta zle. Pozerajú len na cenu webu, ale zabúdajú na hosting, SSL, údržbu, drobné úpravy a fakt, že každá nová funkcia je nová faktúra.",
      "Klasická agentúra: 2 500 – 8 000 € vopred + 200 € ročne hosting + 60 € / hod za úpravy. Po dvoch rokoch máte web, ktorý pôsobí staromódne, a ak chcete pridať blog alebo eshop, idete znova kupovať. Plus riziko, že vývojár zmizne a kód po ňom nikto neprevezme.",
      "Web na prenájom: 35 € mesačne, žiadne vstupné náklady, hosting a SSL v cene, úpravy obsahu zadarmo, AI funkcie zadarmo. Web sa neustále zlepšuje — keď príde nový trend (AI chatbot, voice search, nová Google aktualizácia), nasadíme to vám automaticky.",
      "Kedy sa oplatí kúpa? Keď máte stabilnú firmu, jasný rozpočet 5 000+ € a chcete si web 100 % vlastniť. Pre štart-upy, malé firmy, sezónne kampane alebo testovanie nového biznisu je prenájom matematicky nezbitne lepší.",
    ],
  },
  {
    id: "ai-possibilities",
    icon: Sparkles,
    image: blogAiPossibilities,
    imageBg: "white",
    category: "AI riešenia",
    title: "Čo všetko sa dá dnes vytvoriť pomocou AI riešení",
    excerpt:
      "AI dnes zvláda nielen weby. CRM, eshopy, mobilné aplikácie, chatboty, automatizácie — všetko za zlomok ceny a času.",
    readTime: "6 min",
    date: "Máj 2026",
    publishedAt: "2026-05-10",
    content: [
      "AI prestala byť doménou veľkých korporácií. Dnes vieme s pomocou AI postaviť plnohodnotný produkt — od myšlienky po nasadenie — v rade dní, nie mesiacov. A za zlomok klasickej ceny.",
      "Weby a landing pages: kompletný firemný web s blogom, CRM napojením a SEO setupom. Eshopy: katalóg, košík, platobné brány, sklad, automatické faktúry. Webové aplikácie: rezervačné systémy, klientske zóny, dashboardy s analytikou, interné nástroje pre tímy.",
      "Mobilné aplikácie pre iOS aj Android — verzia webu pre zákazníkov alebo interný nástroj pre vašich ľudí. AI chatboty trénované na vašich dokumentoch, ktoré odpovedajú zákazníkom 24/7 v slovenčine. Automatizácie — od prepojenia formulára s Google Sheetom až po komplexné workflow medzi dvadsiatimi systémami.",
      "Personalizovaný obsah pre každého návštevníka, AI generátory cien a ponúk, hlasoví asistenti, prepisovanie hovorov do textu, automatické generovanie produktových popisov, real-time preklady do desiatok jazykov.",
      "Kľúčový rozdiel oproti klasickému vývoju: rýchlosť a cena. To, čo by tradičná agentúra robila pol roka za 30 000 €, vieme dodať za 2 týždne za zlomok rozpočtu. A naďalej to vyvíjať a vylepšovať podľa toho, ako rastie váš biznis.",
    ],
  },
  {
    id: "ai-features",
    icon: Brain,
    image: blogFeatures,
    category: "Inovácia",
    title: "AI funkcie, ktoré si pred 2 rokmi nemohol mať: chatbot, CRM, personalizácia",
    excerpt:
      "Inteligentný chatbot, automatický CRM, personalizovaný obsah pre každého návštevníka — to všetko je dnes súčasťou moderného webu.",
    readTime: "5 min",
    date: "Apríl 2026",
    publishedAt: "2026-04-20",
    content: [
      "Pred dvoma rokmi mali pokročilé funkcie ako chatbot s vlastnými znalosťami, CRM napojené na web alebo dynamickú personalizáciu obsahu len veľké firmy s rozpočtom v desiatkach tisíc eur.",
      "Dnes je to štandard. AI chatbot, ktorý odpovedá na otázky tvojich zákazníkov 24/7, je súčasťou nášho najvyššieho paušálu. Rovnako CRM systém, ktorý ti automaticky triedi leady podľa pravdepodobnosti predaja, alebo personalizovaný hero, ktorý sa mení podľa toho, odkiaľ návštevník prišiel.",
      "Tieto funkcie už nie sú luxus. Sú konkurenčnou výhodou — a firmy, ktoré ich nemajú, postupne strácajú zákazníkov v prospech tých, ktoré sú o krok vpredu.",
      "Práve preto firmy presúvajú svoje weby na AI riešenia. Nielen kvôli cene a rýchlosti, ale hlavne kvôli funkciám, ktoré ti dajú reálnu výhodu.",
    ],
  },
  {
    id: "ai-cost",
    icon: TrendingDown,
    image: blogCost,
    category: "Úspora",
    title: "0€ vstupných nákladov: ako AI zmenila ekonomiku webov",
    excerpt:
      "Klasická agentúra ti vyfaktúruje 2 000 – 8 000€ vopred. S AI prenájmom platíš mesiac za mesiacom — a začínaš na nule.",
    readTime: "3 min",
    date: "Apríl 2026",
    publishedAt: "2026-04-15",
    content: [
      "Najväčšia bariéra pre malé firmy a živnostníkov pri tvorbe webu boli vždy peniaze. 3 000€ za web je ťažké zaplatiť, keď ešte len rozbiehaš biznis. A k tomu hosting, údržba, úpravy.",
      "AI to úplne mení. Vďaka rýchlosti generovania kódu a obsahu vieme ponúknuť web ako službu — platíš 35€ mesačne a máš plný moderný web vrátane hostingu, SSL, úprav a AI obsahu.",
      "Pre podnikateľov to znamená predvídateľné náklady, žiadnu počiatočnú investíciu a istotu, že web bude vždy aktuálny. Žiadne prekvapenia, žiadne ďalšie faktúry za malé úpravy.",
      "A ak preferuješ klasické vlastníctvo, AI zníži cenu aj jednorazového vývoja — WordPress web už od 800€, plnohodnotný eshop od 1 200€.",
    ],
  },
  {
    id: "ai-speed",
    icon: Zap,
    image: blogSpeed,
    category: "Trend",
    title: "Prečo AI weby vznikajú za 48 hodín namiesto 3 mesiacov",
    excerpt:
      "Tradičná agentúra rozplánuje projekt na týždne. AI dokáže to isté za hodiny — bez kompromisov v kvalite.",
    readTime: "4 min",
    date: "Apríl 2026",
    publishedAt: "2026-04-10",
    content: [
      "V minulosti tvorba webu znamenala mesiace komunikácie, schvaľovaní a opráv. Klient čakal na grafický návrh, potom na kódovanie, potom na obsah, potom na úpravy — a spolu s tým platil hodiny dizajnérov, programátorov, copywriterov.",
      "Dnes sa táto rovnica mení. AI nástroje generujú dizajn, kód aj texty paralelne. Tým, čo trvalo tímu 3 mesiace, dokáže AI s jedným skúseným človekom dodať za 48 hodín. A to bez kompromisov v kvalite.",
      "Pre firmy to znamená jediné: rýchlejšie spustenie kampaní, rýchlejší príchod prvých zákazníkov a nižšie vstupné náklady. Práve preto stále viac firiem prechádza na AI riešenia — buď cez prenájom alebo jednorazový vývoj.",
      "Čo z toho máš ty? Kým konkurencia ešte čaká na ponuku od agentúry, tvoj nový web už predáva.",
    ],
  },
] as Article[]).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

const BlogSection = () => {
  const [openId, setOpenId] = useState<string | null>(null);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);
  const activeIndex = articles.findIndex((a) => a.id === openId);
  const active = activeIndex >= 0 ? articles[activeIndex] : null;

  const goPrev = () => {
    if (activeIndex < 0) return;
    const prev = (activeIndex - 1 + articles.length) % articles.length;
    setOpenId(articles[prev].id);
  };
  const goNext = () => {
    if (activeIndex < 0) return;
    const next = (activeIndex + 1) % articles.length;
    setOpenId(articles[next].id);
  };

  useEffect(() => {
    if (!api) return;
    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap());
    api.on("select", () => setCurrent(api.selectedScrollSnap()));
  }, [api]);

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, activeIndex]);

  return (
    <section className="py-20 relative">
      <div className="container mx-auto px-4 max-w-6xl relative z-10">
        {/* Slowed benefits marquee */}
        <div className="relative mb-16 overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-background to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-background to-transparent z-10" />
          <div
            className="flex animate-marquee gap-4 items-center w-max py-2"
            style={{ animationDuration: "60s" }}
          >
            {[...benefitsMarquee, ...benefitsMarquee].map((b, i) => (
              <div
                key={`${b.label}-${i}`}
                className="flex-shrink-0 flex items-center gap-2.5 px-5 py-3 rounded-full border border-primary/20 bg-card/60 backdrop-blur-sm"
              >
                <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <b.icon className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-sm font-semibold whitespace-nowrap">{b.label}</span>
              </div>
            ))}
          </div>
        </div>

        <AnimatedSection>
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium border border-primary/30 text-primary mb-6">
              <Brain className="w-4 h-4" />
              Blog & insights
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Prečo firmy presúvajú weby{" "}
              <span className="text-gradient">na AI riešenia</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Trendy, ktoré menia spôsob, akým firmy budujú online prítomnosť.
            </p>
          </div>
        </AnimatedSection>

        <Carousel
          setApi={setApi}
          opts={{ align: "start", loop: true }}
          className="w-full"
        >
          <CarouselContent className="-ml-4">
            {articles.map((a, i) => (
              <CarouselItem key={a.id} className="pl-4 sm:basis-1/2 lg:basis-1/3">
                <motion.button
                  type="button"
                  onClick={() => setOpenId(a.id)}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.4, delay: (i % 3) * 0.08 }}
                  className="group text-left rounded-2xl overflow-hidden border border-border/50 bg-card/50 hover:border-primary/40 hover:shadow-[0_8px_30px_-8px_hsl(var(--primary)/0.3)] hover:-translate-y-1 transition-all duration-300 flex flex-col w-full h-full"
                >
                  <div className={`aspect-[16/9] relative overflow-hidden ${a.imageBg === "white" ? "bg-white" : "bg-muted"}`}>
                    <img
                      src={a.image}
                      alt={a.title}
                      loading="lazy"
                      width={1024}
                      height={576}
                      className={`w-full h-full ${a.imageBg === "white" ? "object-contain p-3" : "object-cover"} group-hover:scale-105 transition-transform duration-500`}
                    />
                    <div className="absolute top-3 left-3 w-9 h-9 rounded-lg bg-background/80 backdrop-blur-md flex items-center justify-center border border-border/50">
                      <a.icon className="w-4 h-4 text-primary" />
                    </div>
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                        {a.category}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {a.readTime}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold mb-2 leading-snug group-hover:text-primary transition-colors">
                      {a.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                      {a.excerpt}
                    </p>
                    <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                      Čítať článok
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </motion.button>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden md:flex -left-4 lg:-left-12" />
          <CarouselNext className="hidden md:flex -right-4 lg:-right-12" />
        </Carousel>

        <div className="flex justify-center gap-2 mt-8">
          {count > 0 &&
            Array.from({ length: count }).map((_, i) => (
              <button
                key={i}
                onClick={() => api?.scrollTo(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  current === i
                    ? "bg-primary w-6"
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50 w-2"
                }`}
                aria-label={`Článok ${i + 1}`}
              />
            ))}
        </div>
      </div>

      <Dialog open={!!openId} onOpenChange={(v) => !v && setOpenId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          {active && (
            <div className="flex flex-col">
              <div className={`aspect-[16/8] overflow-hidden relative rounded-t-lg ${active.imageBg === "white" ? "bg-white" : "bg-muted"}`}>
                <img
                  src={active.image}
                  alt={active.title}
                  loading="lazy"
                  width={1024}
                  height={576}
                  className={`w-full h-full ${active.imageBg === "white" ? "object-contain p-4" : "object-cover"}`}
                />
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label="Predchádzajúci článok"
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-background/80 backdrop-blur border border-border hover:bg-primary hover:text-primary-foreground transition flex items-center justify-center shadow-lg"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  aria-label="Ďalší článok"
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-background/80 backdrop-blur border border-border hover:bg-primary hover:text-primary-foreground transition flex items-center justify-center shadow-lg"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <DialogHeader className="space-y-3 text-left">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                      {active.category}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {active.date}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {active.readTime}
                    </span>
                  </div>
                  <DialogTitle className="text-xl sm:text-2xl leading-tight font-bold pr-8 text-left">
                    {active.title}
                  </DialogTitle>
                  <DialogDescription className="sr-only">{active.excerpt}</DialogDescription>
                </DialogHeader>
                <article className="space-y-4 text-sm sm:text-base text-foreground/90 leading-relaxed">
                  {active.content.map((p, i) => (
                    <p key={i} className="text-left">{p}</p>
                  ))}

                  {active.showFullPreviewLink && (
                    <a
                      href={active.image}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block group rounded-xl overflow-hidden border border-border hover:border-primary/50 transition-colors bg-white relative"
                    >
                      <img
                        src={active.image}
                        alt={`${active.title} — plný náhľad CRM`}
                        loading="lazy"
                        className="w-full h-auto object-contain"
                      />
                      <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-background/90 backdrop-blur border border-border text-primary shadow-sm">
                        <Maximize2 className="w-3.5 h-3.5" /> Otvoriť plný náhľad
                      </span>
                    </a>
                  )}

                  {active.hasCta && (
                    <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 border border-primary/30 p-5 text-left mt-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-primary">Tvoj nápad, naša realizácia</span>
                      </div>
                      <h4 className="text-lg font-bold mb-1">Máš nápad na digitálny produkt?</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Pripravíme ti orientačnú cenu a plán spustenia zdarma. Bez vstupných nákladov.
                      </p>
                      <button
                        onClick={() => {
                          setOpenId(null);
                          setTimeout(() => window.dispatchEvent(new Event("open-ai-calculator")), 250);
                        }}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition shadow-lg shadow-primary/30"
                      >
                        Chcem nezáväzný dopyt
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {active.hasProcessCta && (
                    <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 border border-primary/30 p-5 text-left mt-2">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                          ))}
                        </div>
                        <span className="text-xs font-semibold text-foreground/80">
                          4.9/5 · 100+ spokojných klientov
                        </span>
                      </div>
                      <h4 className="text-lg font-bold mb-1">Pustime sa do toho spolu</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Povedz nám, čo potrebuješ — pripravíme ti návrh a orientačnú cenu zdarma. Bez vstupných nákladov, štart do 48 hodín.
                      </p>
                      <button
                        onClick={() => {
                          setOpenId(null);
                          setTimeout(() => window.dispatchEvent(new Event("open-ai-calculator")), 250);
                        }}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition shadow-lg shadow-primary/30"
                      >
                        Chcem nezáväzný dopyt
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {!active.hasCta && !active.hasProcessCta && (
                    <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 border border-primary/30 p-5 text-left mt-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-primary">Spočítaj si cenu</span>
                      </div>
                      <h4 className="text-lg font-bold mb-1">Zaujalo ťa to? Vyskúšaj kalkulačku</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Za 30 sekúnd zistíš orientačnú cenu pre tvoj projekt. Bez vstupných nákladov, bez záväzkov.
                      </p>
                      <button
                        onClick={() => {
                          setOpenId(null);
                          setTimeout(() => window.dispatchEvent(new Event("open-ai-calculator")), 250);
                        }}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition shadow-lg shadow-primary/30"
                      >
                        Spočítať cenu
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </article>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default BlogSection;
