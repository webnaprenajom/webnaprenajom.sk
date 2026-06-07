import AnimatedSection from "../AnimatedSection";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { MessageCircle, Phone } from "lucide-react";
import LeadFormDialogLocalized from "./LeadFormDialogLocalized";
import { useLanguage } from "@/contexts/LanguageContext";

const FaqSectionLocalized = () => {
  const { t } = useLanguage();
  const half = Math.ceil(t.faq.items.length / 2);
  const left = t.faq.items.slice(0, half);
  const right = t.faq.items.slice(half);

  return (
    <section className="py-24 section-alt">
      <div className="container mx-auto px-4 max-w-5xl">
        <AnimatedSection>
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">{t.faq.title}</h2>
          <p className="text-center text-muted-foreground mb-12">{t.faq.subtitle}</p>
        </AnimatedSection>

        <div className="grid md:grid-cols-2 gap-4 mb-12">
          <Accordion type="single" collapsible className="space-y-3">
            {left.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="card-elevated rounded-xl px-6 border-none">
                <AccordionTrigger className="text-left text-foreground font-medium hover:no-underline py-5">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <Accordion type="single" collapsible className="space-y-3">
            {right.map((f, i) => (
              <AccordionItem key={i} value={`item-r-${i}`} className="card-elevated rounded-xl px-6 border-none">
                <AccordionTrigger className="text-left text-foreground font-medium hover:no-underline py-5">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <div className="text-center space-y-3">
          <p className="text-muted-foreground mb-4">{t.faq.notFound}</p>
          <a href="https://wa.me/421911638657?text=M%C3%A1m%20z%C3%A1ujem%20o%20Web%20na%20pren%C3%A1jom%20so%20z%C4%BEavou%20-10%25" target="_blank" rel="noopener noreferrer">
            <Button variant="gradient" size="lg" className="px-8">
              <MessageCircle className="w-5 h-5 mr-2" />{t.faq.ctaWhatsApp}
            </Button>
          </a>
          <p className="text-xs text-muted-foreground mt-2 break-all">wa.me/421911638657</p>
          <div>
            <LeadFormDialogLocalized initialStep="consultation">
              <button className="text-sm text-muted-foreground hover:text-primary transition-colors underline underline-offset-4 mt-2">
                <Phone className="w-3.5 h-3.5 inline mr-1" />{t.faq.ctaConsultation}
              </button>
            </LeadFormDialogLocalized>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FaqSectionLocalized;
