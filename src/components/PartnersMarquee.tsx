import salelogicsLogo from "@/assets/partners/salelogics.png";
import shoptetLogo from "@/assets/partners/shoptet.png";
import napojseLogo from "@/assets/partners/napojse.png";
import makeLogo from "@/assets/partners/make.png";
import baseLogo from "@/assets/partners/baselinker.png";
import mergadoLogo from "@/assets/partners/mergado.png";
import datadepoLogo from "@/assets/partners/datadepo.png";
import pohodaLogo from "@/assets/partners/pohoda.png";
import lovableLogo from "@/assets/partners/lovable.png";

const partners = [
  { name: "SaleLogics", logo: salelogicsLogo, url: "https://www.salelogics.sk" },
  { name: "Shoptet", logo: shoptetLogo, url: "https://shoptet.sk" },
  { name: "Napoj se", logo: napojseLogo, url: "https://www.napojse.cz" },
  { name: "Make", logo: makeLogo, url: "https://www.make.com" },
  { name: "Base", logo: baseLogo, url: "https://www.base.com" },
  { name: "Mergado", logo: mergadoLogo, url: "https://mergado.sk" },
  { name: "DataDepo", logo: datadepoLogo, url: "https://www.datadepo.cz" },
  { name: "Pohoda", logo: pohodaLogo, url: "https://www.stormware.sk" },
  { name: "Lovable", logo: lovableLogo, url: "https://lovable.dev" },
];

const PartnersMarquee = () => {
  const doubled = [...partners, ...partners];

  return (
    <section className="py-14 border-t border-border/50 bg-card/20 overflow-hidden">
      <div className="container mx-auto px-4 mb-10">
        <h2 className="text-center text-2xl md:text-3xl font-bold text-foreground">
          Firmy a nástroje, s ktorými pravidelne pracujeme
        </h2>
      </div>
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-background to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-background to-transparent z-10" />
        <div className="flex animate-marquee gap-16 items-start w-max">
          {doubled.map((partner, i) => (
            <a
              key={`${partner.name}-${i}`}
              href={partner.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 flex flex-col items-center justify-center gap-3 group"
            >
              <div className={`w-20 h-20 flex items-center justify-center rounded-xl backdrop-blur-sm border border-white/10 p-3 transition-all duration-300 group-hover:scale-110 group-hover:border-white/25 group-hover:shadow-lg group-hover:shadow-primary/20 ${partner.name === "Lovable" ? "bg-white group-hover:bg-white/90" : "bg-white/10 group-hover:bg-white/20"}`}>
                <img
                  src={partner.logo}
                  alt={partner.name}
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors duration-300">
                {partner.url.replace("https://", "").replace("www.", "")}
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PartnersMarquee;
