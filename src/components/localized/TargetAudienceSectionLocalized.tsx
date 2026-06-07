import AnimatedSection from "../AnimatedSection";
import { motion } from "framer-motion";
import {
  Building2, User, Briefcase, Camera, Scissors, Dumbbell,
  Stethoscope, Home, Car, GraduationCap, Heart, UtensilsCrossed,
  Globe, RefreshCw,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const icons = [Globe, RefreshCw, Building2, User, Briefcase, Camera, Scissors, Dumbbell, Stethoscope, Home, UtensilsCrossed, Car, GraduationCap, Heart];

const audiences = {
  sk: [
    { label: "Firmy bez webstránky", desc: "Nemáte ešte web? Pomôžeme vám získať prvých zákazníkov online." },
    { label: "Firmy so zastaraným webom", desc: "Váš web vyzerá staro? Modernizujeme ho bez veľkých nákladov." },
    { label: "Malé a stredné firmy", desc: "Profesionálna prezentácia pre váš rastúci biznis." },
    { label: "Živnostníci a freelanceri", desc: "Osobný web, ktorý buduje dôveru u klientov." },
    { label: "Startupy", desc: "Rýchle spustenie webu pre váš nový projekt." },
    { label: "Fotografi a kreatívci", desc: "Portfólio, ktoré predáva vašu prácu." },
    { label: "Salóny krásy a wellness", desc: "Online rezervácie a prezentácia služieb." },
    { label: "Fitnes a športové kluby", desc: "Získajte nových členov cez moderný web." },
    { label: "Lekárske ambulancie", desc: "Dôveryhodná prezentácia vašej praxe." },
    { label: "Hotely a ubytovania", desc: "Zvýšte priame rezervácie bez provízií." },
    { label: "Reštaurácie a kaviarne", desc: "Menu, rezervácie a príbeh vášho podniku." },
    { label: "Autoservisy a predaj áut", desc: "Ponuka vozidiel a služieb online." },
    { label: "Vzdelávacie inštitúcie", desc: "Kurzy a informácie prehľadne na jednom mieste." },
    { label: "Neziskové organizácie", desc: "Predstavte svoju misiu a získajte podporu." },
  ],
  en: [
    { label: "Businesses without a website", desc: "Don't have a website yet? We'll help you get your first customers online." },
    { label: "Outdated websites", desc: "Your website looks old? We'll modernize it without big costs." },
    { label: "Small & medium businesses", desc: "Professional presentation for your growing business." },
    { label: "Freelancers & solopreneurs", desc: "Personal website that builds client trust." },
    { label: "Startups", desc: "Quick website launch for your new project." },
    { label: "Photographers & creatives", desc: "Portfolio that sells your work." },
    { label: "Beauty salons & wellness", desc: "Online booking and service presentation." },
    { label: "Fitness & sports clubs", desc: "Get new members through a modern website." },
    { label: "Medical practices", desc: "Trustworthy presentation of your practice." },
    { label: "Hotels & accommodations", desc: "Increase direct bookings without commissions." },
    { label: "Restaurants & cafés", desc: "Menu, reservations and your venue's story." },
    { label: "Auto services & car sales", desc: "Vehicle and service offerings online." },
    { label: "Educational institutions", desc: "Courses and info clearly in one place." },
    { label: "Non-profit organizations", desc: "Present your mission and gain support." },
  ],
  de: [
    { label: "Unternehmen ohne Website", desc: "Noch keine Website? Wir helfen Ihnen, erste Kunden online zu gewinnen." },
    { label: "Veraltete Websites", desc: "Ihre Website sieht alt aus? Wir modernisieren sie ohne große Kosten." },
    { label: "Kleine & mittlere Unternehmen", desc: "Professionelle Präsentation für Ihr wachsendes Geschäft." },
    { label: "Freiberufler & Selbständige", desc: "Persönliche Website, die Vertrauen bei Kunden aufbaut." },
    { label: "Startups", desc: "Schneller Website-Start für Ihr neues Projekt." },
    { label: "Fotografen & Kreative", desc: "Portfolio, das Ihre Arbeit verkauft." },
    { label: "Schönheitssalons & Wellness", desc: "Online-Buchung und Dienstleistungspräsentation." },
    { label: "Fitness & Sportvereine", desc: "Neue Mitglieder über eine moderne Website gewinnen." },
    { label: "Arztpraxen", desc: "Vertrauenswürdige Präsentation Ihrer Praxis." },
    { label: "Hotels & Unterkünfte", desc: "Erhöhen Sie Direktbuchungen ohne Provisionen." },
    { label: "Restaurants & Cafés", desc: "Speisekarte, Reservierungen und die Geschichte Ihres Lokals." },
    { label: "Autowerkstätten & Autoverkauf", desc: "Fahrzeug- und Serviceangebote online." },
    { label: "Bildungseinrichtungen", desc: "Kurse und Informationen übersichtlich an einem Ort." },
    { label: "Gemeinnützige Organisationen", desc: "Präsentieren Sie Ihre Mission und gewinnen Sie Unterstützung." },
  ],
};

const titleMap = {
  sk: { title: "Pre koho je to", highlight: "ideálne", subtitle: "Web na prenájom funguje pre akékoľvek podnikanie", more: "... a desiatky ďalších odvetví" },
  en: { title: "Who is it", highlight: "ideal for", subtitle: "Website rental works for any business", more: "... and dozens of other industries" },
  de: { title: "Für wen ist es", highlight: "ideal", subtitle: "Website-Miete funktioniert für jedes Unternehmen", more: "... und Dutzende weiterer Branchen" },
};

const TargetAudienceSectionLocalized = () => {
  const { lang } = useLanguage();
  const items = audiences[lang];
  const t = titleMap[lang];

  return (
    <section className="py-24 section-warm">
      <div className="container mx-auto px-4 max-w-6xl">
        <AnimatedSection>
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              {t.title} <span className="text-gradient">{t.highlight}</span>
            </h2>
            <p className="text-muted-foreground text-lg">{t.subtitle}</p>
          </div>
        </AnimatedSection>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((a, i) => {
            const Icon = icons[i];
            return (
              <motion.div key={a.label} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: i * 0.04 }} className="card-gradient rounded-xl p-5 flex items-start gap-4 hover:border-primary/20 transition-all duration-200 hover:-translate-y-0.5">
                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-foreground block mb-1">{a.label}</span>
                  <span className="text-xs text-muted-foreground leading-relaxed">{a.desc}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
        <p className="text-center text-muted-foreground text-sm mt-8">{t.more}</p>
      </div>
    </section>
  );
};

export default TargetAudienceSectionLocalized;
