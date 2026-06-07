import { useEffect, useRef } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import AnimatedSection from "./AnimatedSection";
import {
  Building2, User, Briefcase, Camera, Scissors, Dumbbell,
  Stethoscope, Home, Car, GraduationCap, Heart, UtensilsCrossed,
  Globe, RefreshCw,
} from "lucide-react";

const audiences = [
  { icon: Globe, label: "Firmy bez webstránky", desc: "Nemáte ešte web? Pomôžeme vám získať prvých zákazníkov online." },
  { icon: RefreshCw, label: "Firmy so zastaraným webom", desc: "Váš web vyzerá staro? Modernizujeme ho bez veľkých nákladov." },
  { icon: Building2, label: "Malé a stredné firmy", desc: "Profesionálna prezentácia pre váš rastúci biznis." },
  { icon: User, label: "Živnostníci a freelanceri", desc: "Osobný web, ktorý buduje dôveru u klientov." },
  { icon: Briefcase, label: "Startupy", desc: "Rýchle spustenie webu pre váš nový projekt." },
  { icon: Camera, label: "Fotografi a kreatívci", desc: "Portfólio, ktoré predáva vašu prácu." },
  { icon: Scissors, label: "Salóny krásy a wellness", desc: "Online rezervácie a prezentácia služieb." },
  { icon: Dumbbell, label: "Fitnes a športové kluby", desc: "Získajte nových členov cez moderný web." },
  { icon: Stethoscope, label: "Lekárske ambulancie", desc: "Dôveryhodná prezentácia vašej praxe." },
  { icon: Home, label: "Hotely a ubytovania", desc: "Zvýšte priame rezervácie bez provízií." },
  { icon: UtensilsCrossed, label: "Reštaurácie a kaviarne", desc: "Menu, rezervácie a príbeh vášho podniku." },
  { icon: Car, label: "Autoservisy a predaj áut", desc: "Ponuka vozidiel a služieb online." },
  { icon: GraduationCap, label: "Vzdelávacie inštitúcie", desc: "Kurzy a informácie prehľadne na jednom mieste." },
  { icon: Heart, label: "Neziskové organizácie", desc: "Predstavte svoju misiu a získajte podporu." },
];

const TargetAudienceSection = () => {
  const autoplay = useRef(Autoplay({ delay: 2800, stopOnInteraction: false, stopOnMouseEnter: true }));
  const [emblaRef] = useEmblaCarousel(
    { loop: true, align: "start", dragFree: true },
    [autoplay.current]
  );

  return (
    <section className="py-24 section-alt overflow-hidden">
      <div className="container mx-auto px-4 max-w-6xl">
        <AnimatedSection>
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Pre koho je to <span className="text-gradient">ideálne</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              Web na prenájom funguje pre akékoľvek podnikanie
            </p>
          </div>
        </AnimatedSection>

        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex gap-4">
            {audiences.map((a) => (
              <div
                key={a.label}
                className="flex-[0_0_85%] sm:flex-[0_0_45%] lg:flex-[0_0_30%] min-w-0"
              >
                <div className="card-gradient rounded-xl p-5 flex items-start gap-4 hover:border-primary/20 transition-all duration-200 h-full">
                  <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                    <a.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-foreground block mb-1">{a.label}</span>
                    <span className="text-xs text-muted-foreground leading-relaxed">{a.desc}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-muted-foreground text-sm mt-8">
          ... a desiatky ďalších odvetví
        </p>
      </div>
    </section>
  );
};

export default TargetAudienceSection;
