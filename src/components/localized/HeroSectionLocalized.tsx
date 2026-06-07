import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import heroVideoNew from "@/assets/hero-video-new.mov";
import heroThumbnail from "@/assets/hero-thumbnail.png";
import LeadFormDialogLocalized from "./LeadFormDialogLocalized";
import { ArrowRight, Bot, Calendar, Play } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const useSequentialTyping = (lines: string[], speed = 90, delayBetween = 400) => {
  const [completedLines, setCompletedLines] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState("");
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    if (lineIndex >= lines.length) {
      setDone(true);
      return;
    }

    const fullLine = lines[lineIndex];

    if (charIndex <= fullLine.length) {
      const timeout = setTimeout(() => {
        setCurrentLine(fullLine.substring(0, charIndex));
        setCharIndex((c) => c + 1);
      }, speed);
      return () => clearTimeout(timeout);
    }

    const timeout = setTimeout(() => {
      setCompletedLines((prev) => [...prev, fullLine]);
      setCurrentLine("");
      setCharIndex(0);
      setLineIndex((l) => l + 1);
    }, delayBetween);
    return () => clearTimeout(timeout);
  }, [charIndex, lineIndex, lines, speed, delayBetween, done]);

  return { completedLines, currentLine, done };
};

const HeroSectionLocalized = () => {
  const { t } = useLanguage();
  const [videoPlaying, setVideoPlaying] = useState(false);
  const { completedLines, currentLine, done } = useSequentialTyping(t.hero.benefits, 70, 300);

  return (
    <section className="relative min-h-[85vh] flex items-center overflow-hidden pt-20 pb-16">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="container mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center relative z-10">
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7 }}
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium border border-primary/30 text-primary mb-6">
            <Bot className="w-4 h-4 animate-pulse" />
            {t.hero.badge}
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
            {t.hero.title}{" "}
            <span className="text-gradient">{t.hero.titleHighlight}</span>
          </h1>

          <p className="text-lg text-muted-foreground mb-2">
            {t.hero.subtitle}
          </p>

          <div className="mb-10">
            <p className="text-lg md:text-xl font-semibold text-foreground mb-4">
              {t.hero.aiLabel}
            </p>
            <div className="space-y-2 min-h-[180px]">
              {completedLines.map((line, i) => {
                const isLast = done && i === completedLines.length - 1;
                return (
                  <p key={i} className="text-lg md:text-xl text-foreground font-medium flex items-center gap-3">
                    <span className="text-primary">✔</span>
                    {line}
                    {isLast && (
                      <span className="inline-block w-0.5 h-6 bg-primary animate-[pulse_1s_ease-in-out_infinite] ml-1" />
                    )}
                  </p>
                );
              })}
              {currentLine !== "" && (
                <p className="text-lg md:text-xl text-foreground font-medium flex items-center gap-3">
                  <span className="text-primary">✔</span>
                  {currentLine}
                  <span className="inline-block w-0.5 h-6 bg-primary animate-[pulse_1s_ease-in-out_infinite]" />
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <LeadFormDialogLocalized initialStep="inquiry">
              <Button variant="gradient" size="lg" className="px-8 py-6 text-lg">
                {t.hero.ctaProposal} <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </LeadFormDialogLocalized>
            <LeadFormDialogLocalized initialStep="consultation">
              <Button variant="gradient-outline" size="lg" className="px-8 py-6 text-lg">
                <Calendar className="mr-2 w-5 h-5" /> {t.hero.ctaConsultation}
              </Button>
            </LeadFormDialogLocalized>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="hidden lg:flex justify-center"
        >
          <div className="relative rounded-2xl overflow-hidden glow-border w-full max-w-4xl aspect-[4/3]">
            {!videoPlaying ? (
              <>
                <img
                  src={heroThumbnail}
                  alt="AI Web na prenájom"
                  className="w-full h-full object-cover rounded-2xl"
                />
                <button
                  onClick={() => setVideoPlaying(true)}
                  className="absolute inset-0 flex items-center justify-center group"
                >
                  <span className="relative flex items-center justify-center w-20 h-20 rounded-full bg-primary/90 text-primary-foreground shadow-lg group-hover:scale-110 transition-transform">
                    <span className="absolute inset-0 rounded-full bg-primary/50 animate-[ping_2.5s_cubic-bezier(0,0,0.2,1)_infinite]" />
                    <Play className="w-8 h-8 ml-1 relative z-10" fill="currentColor" />
                  </span>
                </button>
              </>
            ) : (
              <video
                src={heroVideoNew}
                autoPlay
                controls
                playsInline
                className="w-full h-full object-contain rounded-2xl bg-black"
              />
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSectionLocalized;
