import { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

const stats = [
  { target: 100, suffix: "+", label: "vytvorených webov" },
  { target: 48, suffix: "h", label: "priemerné spustenie" },
  { target: 98, suffix: "%", label: "spokojnosť klientov" },
  { target: 0, suffix: "€", label: "vstupné náklady", countDown: true },
];

const useCountUp = (target: number, inView: boolean, duration = 3000) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (target === 0) { setValue(0); return; }
    let start = 0;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setValue(target); clearInterval(timer); }
      else setValue(start);
    }, 16);
    return () => clearInterval(timer);
  }, [inView, target, duration]);
  return value;
};

const portfolio = [
  { name: "BATERIX", img: "https://www.salelogics.sk/wp-content/uploads/2026/04/LOGICS-portfolio-22.png" },
  { name: "DPF bez montáže", img: "https://www.salelogics.sk/wp-content/uploads/2026/03/LOGICS-portfolio-2.png" },
  { name: "Tatra Gym", img: "https://www.salelogics.sk/wp-content/uploads/2025/02/Tatra-Gym-uvod.png" },
  { name: "7Days Gym", img: "https://www.salelogics.sk/wp-content/uploads/2026/04/LOGICS-portfolio-5-1.png" },
  { name: "SopakCar", img: "https://www.salelogics.sk/wp-content/uploads/2025/03/LOGICS-portfolio-3.png" },
  { name: "Art4You", img: "https://www.salelogics.sk/wp-content/uploads/2025/07/LOGICS-portfolio.png" },
  { name: "Likvidácia spoločností", img: "https://www.salelogics.sk/wp-content/uploads/2025/04/LOGICS-portfolio.png" },
  { name: "Drevopal", img: "https://www.salelogics.sk/wp-content/uploads/2025/02/Drevopal-II.png" },
  { name: "Ros Hof", img: "https://www.salelogics.sk/wp-content/uploads/2025/03/LOGICS-portfolio-1-1.png" },
  { name: "Nábytok na mieru", img: "https://www.salelogics.sk/wp-content/uploads/2025/03/LOGICS-portfolio-1-e1747787180201.png" },
  { name: "Car Shop 7Days", img: "https://www.salelogics.sk/wp-content/uploads/2026/04/LOGICS-portfolio-6.png" },
  { name: "IzoTam", img: "https://www.salelogics.sk/wp-content/uploads/2026/04/LOGICS-portfolio.png" },
  { name: "Solaras", img: "https://www.salelogics.sk/wp-content/uploads/2026/04/Solaras.png" },
  { name: "Dermagyn", img: "https://www.salelogics.sk/wp-content/uploads/2025/05/LOGICS-portfolio-1.png" },
  { name: "ZUPKO", img: "https://www.salelogics.sk/wp-content/uploads/2025/07/LOGICS-portfolio-3.png" },
  { name: "LV Medical", img: "https://www.salelogics.sk/wp-content/uploads/2025/07/LOGICS-portfolio-4.png" },
  { name: "Kardiomed", img: "https://www.salelogics.sk/wp-content/uploads/2025/03/LOGICS-portfolio.png" },
  { name: "Tuláčik centrum", img: "https://www.salelogics.sk/wp-content/uploads/2025/03/LOGICS-portfolio-2-1.png" },
  { name: "Dream Day", img: "https://www.salelogics.sk/wp-content/uploads/2025/11/LOGICS-portfolio.png" },
  { name: "RENOVUM", img: "https://www.salelogics.sk/wp-content/uploads/2026/04/LOGICS-portfolio-4.png" },
  { name: "Poh-servis", img: "https://www.salelogics.sk/wp-content/uploads/2026/04/LOGICS-portfolio-8.png" },
  { name: "Egypt nehnuteľnosti", img: "https://www.salelogics.sk/wp-content/uploads/2026/04/LOGICS-portfolio-7.png" },
  { name: "My Body my Art", img: "https://www.salelogics.sk/wp-content/uploads/2025/02/MyBodyMyArt-by-Logics.png" },
  { name: "LiaVisage", img: "https://www.salelogics.sk/wp-content/uploads/2025/03/LOGICS-portfolio-1-2.png" },
  { name: "SalonWoman", img: "https://www.salelogics.sk/wp-content/uploads/2025/03/LOGICS-portfolio-2.png" },
  { name: "Kajlova Coaching", img: "/portfolio/kajlova-coaching.png" },
  { name: "Janka Kordiak", img: "https://www.salelogics.sk/wp-content/uploads/2025/07/LOGICS-portfolio-2.png" },
  { name: "Harmonia masáže", img: "https://www.salelogics.sk/wp-content/uploads/2026/04/LOGICS-portfolio-9.png" },
  { name: "Promeo", img: "https://www.salelogics.sk/wp-content/uploads/2026/04/LOGICS-portfolio-19.png" },
  { name: "Kontajnery Vlasak", img: "https://www.salelogics.sk/wp-content/uploads/2026/04/LOGICS-portfolio-18.png" },
  { name: "Bautechnik", img: "https://www.salelogics.sk/wp-content/uploads/2026/04/LOGICS-portfolio-20.png" },
  { name: "Pusher Technologies", img: "https://www.salelogics.sk/wp-content/uploads/2026/04/LOGICS-portfolio-13.png" },
  { name: "Zelomix", img: "https://www.salelogics.sk/wp-content/uploads/2026/04/LOGICS-portfolio-2-2.png" },
  { name: "BIOPACK", img: "https://www.salelogics.sk/wp-content/uploads/2026/04/LOGICS-portfolio-7-1.png" },
  { name: "Aladin Pua", img: "https://www.salelogics.sk/wp-content/uploads/2026/04/LOGICS-portfolio-6-1.png" },
  { name: "Herne PC", img: "https://www.salelogics.sk/wp-content/uploads/2025/07/LOGICS-portfolio-5.jpg" },
  { name: "Noxstore", img: "https://www.salelogics.sk/wp-content/uploads/2026/04/LOGICS-portfolio-4-1.png" },
  { name: "Up to sky Safety", img: "https://www.salelogics.sk/wp-content/uploads/2026/04/LOGICS-portfolio-5-2.png" },
  { name: "Solaras Eshop", img: "https://www.salelogics.sk/wp-content/uploads/2026/04/LOGICS-portfolio-3-2.png" },
  { name: "Art4You Eshop", img: "https://www.salelogics.sk/wp-content/uploads/2025/07/LOGICS-portfolio-6.jpg" },
  { name: "Gumiok CZ", img: "https://www.salelogics.sk/wp-content/uploads/2022/07/LOGICS-portfolio-14.png" },
  { name: "Gumiok HU", img: "https://www.salelogics.sk/wp-content/uploads/2022/07/LOGICS-portfolio-15.png" },
  { name: "Gumiok SK", img: "https://www.salelogics.sk/wp-content/uploads/2023/03/Gumiok.sk-LOGICS-portfolio-_1_.webp" },
  { name: "Otrade", img: "https://www.salelogics.sk/wp-content/uploads/2024/02/Otrade.jpg" },
  { name: "Elekareň", img: "https://www.salelogics.sk/wp-content/uploads/2025/01/elekaren-by-salelogics.webp" },
  { name: "2Stvory", img: "https://www.salelogics.sk/wp-content/uploads/2022/08/LOGICS-portfolio-2.png" },
  { name: "Euro-mix", img: "https://www.salelogics.sk/wp-content/uploads/2026/04/LOGICS-portfolio-8-1.png" },
  { name: "Autoparts Roka", img: "https://www.salelogics.sk/wp-content/uploads/2026/04/LOGICS-portfolio-9-1.png" },
  { name: "AladinPua EU", img: "https://www.salelogics.sk/wp-content/uploads/2026/04/148.png" },
  { name: "Diathin", img: "https://www.salelogics.sk/wp-content/uploads/2026/04/147.png" },
  { name: "Carpbon", img: "https://www.salelogics.sk/wp-content/uploads/2026/04/146.png" },
  { name: "Bibis Grocery", img: "https://www.salelogics.sk/wp-content/uploads/2026/04/144.png" },
  { name: "Návrh bývania", img: "https://www.salelogics.sk/wp-content/uploads/2026/04/143.png" },
];

const AnimatedStat = ({ stat, index, inView }: { stat: typeof stats[0]; index: number; inView: boolean }) => {
  const value = useCountUp(stat.target, inView);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.15 }}
      className="flex items-center gap-3 justify-center"
    >
      <span className="text-4xl md:text-5xl font-bold text-gradient tabular-nums">
        {value}{stat.suffix}
      </span>
      <span className="text-muted-foreground text-sm leading-tight max-w-[100px]">{stat.label}</span>
    </motion.div>
  );
};

const SocialProofSection = () => {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);
  const statsRef = useRef<HTMLDivElement>(null);
  const inView = useInView(statsRef, { once: true, margin: "-100px" });

  useEffect(() => {
    if (!api) return;
    
    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap());

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  return (
    <section className="py-20 section-accent-glow">
      <div className="container mx-auto px-4 max-w-6xl">
        <div ref={statsRef} className="grid grid-cols-2 md:flex md:flex-row items-center justify-center gap-6 md:gap-16 mb-16">
          {stats.map((s, i) => (
            <AnimatedStat key={s.label} stat={s} index={i} inView={inView} />
          ))}
        </div>

        {/* Portfolio - carousel style */}
        <div className="text-center mb-8">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Naše realizácie</p>
        </div>

        <div className="relative">
          <Carousel
            setApi={setApi}
            opts={{
              align: "start",
              loop: true,
            }}
            plugins={[
              Autoplay({
                delay: 3000,
              }),
            ]}
            className="w-full"
          >
            <CarouselContent>
              {portfolio.map((p) => (
                <CarouselItem key={p.name} className="md:basis-1/2 lg:basis-1/4">
                  <div className="card-elevated rounded-xl overflow-hidden">
                    <div className="aspect-[4/3]">
                      <img
                        src={p.img}
                        alt={p.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-3 flex items-center justify-center">
                      <span className="font-medium text-sm">{p.name}</span>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>

          {/* Pagination dots */}
          <div className="flex justify-center gap-2 mt-6">
            {count > 0 && Array.from({ length: count }).map((_, i) => (
              <button
                key={i}
                onClick={() => api?.scrollTo(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  current === i 
                    ? "bg-primary w-6" 
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50 w-2"
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default SocialProofSection;
