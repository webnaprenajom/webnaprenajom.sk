import AnimatedSection from "./AnimatedSection";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { MessageCircle, Phone } from "lucide-react";
import LeadFormDialog from "./LeadFormDialog";

const faqs: { q: string; a: React.ReactNode }[] = [
  {
    q: "S kým budete spolupracovať?",
    a: <>Za projektom stojí tím zo <a href="https://www.salelogics.sk" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4 hover:text-primary/80 transition-colors">SaleLogics.sk</a>, ktorý pomáha firmám rásť online – od webov cez marketing až po automatizácie. Máme skúsenosti s tvorbou desiatok webových stránok, e-shopov a marketingových kampaní pre firmy naprieč Slovenskom aj v zahraničí. Nie sme agentúra, čo ti hodí web a zmizne. Staviame na dlhodobej spolupráci, kde tvoj web neustále vylepšujeme, optimalizujeme a prispôsobujeme potrebám tvojho biznisu. Náš tím kombinuje odbornosť v dizajne, vývoji, SEO a AI technológiách, aby sme ti dodali riešenie, ktoré skutočne funguje a prináša výsledky.</>,
  },
  {
    q: "Pre koho je služba určená?",
    a: "Pre malé a stredné firmy, podnikateľov, čo nechcú riešiť technické veci, a firmy, ktoré chcú výsledky – dopyty, zákazníkov, landing stránky s CTA, funely napojené na platobnú bránu a viac.",
  },
  {
    q: "Čo znamená \u201Eweb na prenájom\u201C?",
    a: "Neplatíš tisíce € naraz. Máš web na mesačný poplatok a všetko je v cene – web, údržba, AI, podpora. My sa staráme o web. Ty riešiš biznis.",
  },
  {
    q: "Ako funguje spolupráca?",
    a: "Krátky call – zistíme, čo potrebuješ. Navrhneme riešenie (web + AI + marketing). Spustíme web. Neustále ho zlepšujeme podľa dát. Nie je to jednorazovka. Je to spolupráca.",
  },
  {
    q: "Bude mi web reálne prinášať zákazníkov?",
    a: "Web netvoríme len ako vizitku, ale ako nástroj na získavanie zákazníkov. Každý web je navrhnutý tak, aby premieňal návštevníkov na dopyty – pomocou správnej štruktúry, obsahu a AI prvkov. Zároveň ho priebežne zlepšujeme podľa dát, aby mal čo najlepší výkon. Cieľ je jednoduchý: aby vám web zarábal, nie len dobre vyzeral.",
  },
  {
    q: "Ako rýchlo bude web hotový?",
    a: "Väčšinu webov spúšťame do 48 hodín. Pri zložitejších projektoch to môže byť niekoľko dní.",
  },
  {
    q: "Čo všetko je zahrnuté v cene?",
    a: "Profesionálny dizajn, technická správa, aktualizácie, mobilná optimalizácia, SEO základ a AI pomoc pri tvorbe obsahu.",
  },
  {
    q: "Môžem web kedykoľvek upraviť?",
    a: "Áno, úpravy sú súčasťou služby. Stačí nás kontaktovať a zmeny vykonáme za vás.",
  },
  {
    q: "Je web optimalizovaný pre mobil?",
    a: "Každý web je plne responzívny a testovaný na všetkých zariadeniach.",
  },
  {
    q: "Môžem službu kedykoľvek zrušiť?",
    a: "Minimálna viazanosť je 6 mesiacov – závisí od zložitosti požadovaného webu. Po uplynutí viazanosti môžete službu zrušiť kedykoľvek bez penále.",
  },
  {
    q: "Potrebujem mať vlastnú doménu?",
    a: "Nie je to nutné. Pomôžeme vám s registráciou domény alebo prepojíme existujúcu.",
  },
  {
    q: "Čo ak mi táto služba nevyhovuje, máte v ponuke aj iné?",
    a: <>Okrem tejto služby máme v ponuke custom riešenia na platforme WordPress a pre e-shopové riešenia platformu Shoptet pre automatizované e-shopy. Kompletný prehľad služieb nájdete na našej hlavnej stránke{" "}<a href="https://www.salelogics.sk" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4 hover:text-primary/80 transition-colors">www.salelogics.sk</a>.</>,
  },
];

const FaqSection = () => {
  const half = Math.ceil(faqs.length / 2);
  const left = faqs.slice(0, half);
  const right = faqs.slice(half);

  return (
    <section className="py-24 section-alt">
      <div className="container mx-auto px-4 max-w-5xl">
        <AnimatedSection>
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Máte otázky?
          </h2>
          <p className="text-center text-muted-foreground mb-12">
            Tu sú odpovede na najčastejšie otázky
          </p>
        </AnimatedSection>

        <div className="grid md:grid-cols-2 gap-4 mb-12">
          <Accordion type="single" collapsible className="space-y-3">
            {left.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="card-elevated rounded-xl px-6 border-none">
                <AccordionTrigger className="text-left text-foreground font-medium hover:no-underline py-5">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <Accordion type="single" collapsible className="space-y-3">
            {right.map((f, i) => (
              <AccordionItem key={i} value={`item-r-${i}`} className="card-elevated rounded-xl px-6 border-none">
                <AccordionTrigger className="text-left text-foreground font-medium hover:no-underline py-5">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

      <div className="text-center space-y-3">
        <p className="text-muted-foreground mb-4">Nenašli ste odpoveď?</p>
        <a
          href="https://wa.me/421911638657?text=M%C3%A1m%20z%C3%A1ujem%20o%20Web%20na%20pren%C3%A1jom%20so%20z%C4%BEavou%20-10%25"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="gradient" size="lg" className="px-8">
            <MessageCircle className="w-5 h-5 mr-2" />
            Napíšte nám na WhatsApp
          </Button>
        </a>
        <p className="text-xs text-muted-foreground mt-2 break-all">
          wa.me/421911638657
        </p>
        <div>
          <LeadFormDialog initialStep="consultation">
            <button className="text-sm text-muted-foreground hover:text-primary transition-colors underline underline-offset-4 mt-2">
              <Phone className="w-3.5 h-3.5 inline mr-1" />
              alebo si rezervujte bezplatnú konzultáciu
            </button>
          </LeadFormDialog>
        </div>
      </div>
    </div>
    </section>
  );
};

export default FaqSection;
