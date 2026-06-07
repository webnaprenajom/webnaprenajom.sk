import { useState, useEffect } from "react";
import { Star, Quote } from "lucide-react";
import AnimatedSection from "./AnimatedSection";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

const testimonials = [
  {
    name: "Martin K.",
    role: "Majiteľ stolárskej dielne",
    text: "Predtým som za web zaplatil 2 000 € a nedostal som ani jeden dopyt. Tu som mal web do 2 dní a za prvý mesiac prišlo 14 dopytov. Konečne to funguje.",
    stars: 5,
  },
  {
    name: "Zuzana P.",
    role: "Kozmetický salón",
    text: "Nechcela som riešiť technické veci. Povedala som, čo potrebujem, a o 48 hodín som mala krásny web. Úpravy riešia oni, ja sa starám o klientky.",
    stars: 5,
  },
  {
    name: "Tomáš R.",
    role: "Elektrikár – SZČO",
    text: "Model prenájmu ma presvedčil. Žiadna vstupná investícia, platím 35 € mesačne a web mi generuje zákazky. Lepšia investícia ako reklama na Facebooku.",
    stars: 5,
  },
  {
    name: "Jana M.",
    role: "Účtovníčka",
    text: "Mala som starý WordPress web, ktorý sa stále kazil. Prešla som na prenájom a konečne mám pokoj. Všetko riešia za mňa a web vyzerá profesionálne.",
    stars: 5,
  },
  {
    name: "Peter V.",
    role: "Fitness tréner",
    text: "AI chatbot na webe mi šetrí hodiny denne. Klienti si cez neho rezervujú tréningy a ja nemusím odpovedať na rovnaké otázky stále dokola.",
    stars: 5,
  },
  {
    name: "Lucia H.",
    role: "Kvetinárstvo",
    text: "Web mám krásny, rýchly a zákazníci ho chvália. Najlepšie je, že ho neustále vylepšujú podľa dát – nie je to jednorazovka ako u iných.",
    stars: 5,
  },
  {
    name: "Marek D.",
    role: "Autoservis",
    text: "Spustili nám web za 48 hodín, čo som nečakal. SEO začalo fungovať do mesiaca a teraz máme stabilne 20+ dopytov mesačne z Googlu.",
    stars: 5,
  },
  {
    name: "Andrea S.",
    role: "Realitná maklérka",
    text: "Potrebovala som landing page na kampane. Urobili mi ju za deň a konverzie sú 3x lepšie ako predtým. Spolupráca na jednotku.",
    stars: 5,
  },
  {
    name: "Juraj B.",
    role: "Stavebná firma",
    text: "Vyskúšali sme 3 agentúry predtým. Tu konečne cítim, že im záleží na výsledkoch, nie len na tom, aby web dobre vyzeral. A vyzerá tiež skvele.",
    stars: 5,
  },
  {
    name: "Katarína N.",
    role: "Online shop s handmade výrobkami",
    text: "Za 35 € mesačne mám profesionálny web, ktorý by ma inde stál tisíce. Plus sa mi ozvali aj zákazníci zo zahraničia vďaka viacjazyčnej verzii.",
    stars: 5,
  },
  {
    name: "Roman G.",
    role: "Inštalatér",
    text: "Nerozumiem technológiám, ale nemusel som. Stačil jeden telefonát a o dva dni som mal funkčný web s kontaktným formulárom. Odporúčam každému remeselníkovi.",
    stars: 5,
  },
  {
    name: "Eva T.",
    role: "Jazyková škola",
    text: "Web nám pomohol zvýšiť počet prihlášok o 40 %. Oceňujem, že priebežne robia A/B testy a optimalizujú, aby sme mali čo najlepšie výsledky.",
    stars: 5,
  },
];

const TestimonialsSection = () => {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!api) return;
    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap());
    api.on("select", () => setCurrent(api.selectedScrollSnap()));
  }, [api]);

  return (
    <section className="relative py-24 section-accent-glow overflow-hidden">
      {/* decorative background blobs */}
      <div className="pointer-events-none absolute -top-32 -left-20 w-[420px] h-[420px] rounded-full bg-primary/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 w-[420px] h-[420px] rounded-full bg-accent/20 blur-[120px]" />

      <div className="container mx-auto px-4 max-w-6xl relative">
        <AnimatedSection>
          <div className="flex justify-center mb-4">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider border border-primary/30 bg-primary/10 text-primary">
              <Star className="w-3.5 h-3.5 fill-primary" /> Overené recenzie
            </span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold text-center mb-3">
            Čo hovoria <span className="text-gradient">naši klienti</span>
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
            Prečo si vybrali web na prenájom a ako im pomohol rásť
          </p>
        </AnimatedSection>

        <Carousel
          setApi={setApi}
          opts={{ align: "start", loop: true }}
          plugins={[Autoplay({ delay: 4500 })]}
          className="w-full"
        >
          <CarouselContent>
            {testimonials.map((t, i) => (
              <CarouselItem key={i} className="md:basis-1/2 lg:basis-1/3">
                <div className="group relative h-full">
                  {/* gradient border */}
                  <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-primary/60 via-accent/40 to-primary/60 opacity-40 group-hover:opacity-100 blur-sm transition-opacity duration-500" />
                  <div className="relative card-elevated rounded-2xl p-6 h-full flex flex-col gap-4 bg-card/95 backdrop-blur-sm group-hover:-translate-y-1 transition-transform duration-500">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-0.5">
                        {Array.from({ length: t.stars }).map((_, si) => (
                          <Star key={si} className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                        ))}
                      </div>
                      <Quote className="w-10 h-10 text-primary/30 -mr-1" />
                    </div>
                    <p className="text-foreground/90 text-[15px] leading-relaxed flex-1 italic">
                      „{t.text}"
                    </p>
                    <div className="flex items-center gap-3 pt-4 border-t border-border/60">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold shadow-lg shadow-primary/30">
                        {t.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-foreground">{t.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{t.role}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        <div className="flex justify-center gap-2 mt-6">
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
                aria-label={`Recenzia ${i + 1}`}
              />
            ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
