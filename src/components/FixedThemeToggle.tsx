import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const FixedThemeToggle = () => {
  const [isDark, setIsDark] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.classList.remove("light");
      setIsDark(true);
    } else {
      document.documentElement.classList.add("light");
      setIsDark(false);
    }
  }, []);

  useEffect(() => {
    const onScroll = () => setHeaderVisible(window.scrollY > 500);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.remove("light");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.add("light");
      localStorage.setItem("theme", "light");
    }
  };

  // Hide when sticky header is visible (it has its own toggle)
  if (headerVisible) return null;

  return (
    <button
      onClick={toggle}
      className="fixed top-4 right-4 z-40 flex items-center justify-center w-10 h-10 rounded-full border border-border/50 bg-background/80 backdrop-blur-lg hover:border-primary/50 hover:bg-primary/5 transition-all shadow-lg"
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Sun className="w-5 h-5 text-muted-foreground" />
      ) : (
        <Moon className="w-5 h-5 text-muted-foreground" />
      )}
    </button>
  );
};

export default FixedThemeToggle;
