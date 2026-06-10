import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getTheme, setTheme } from "@/lib/initTheme";

export function AdminThemeToggle() {
  const [mode, setMode] = useState<"light" | "dark">("dark");

  useEffect(() => {
    setMode(getTheme());
  }, []);

  const toggle = () => {
    const next = mode === "dark" ? "light" : "dark";
    setTheme(next);
    setMode(next);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="h-8 w-8 shrink-0"
      onClick={toggle}
      aria-label={mode === "dark" ? "Prepnúť na svetlý režim" : "Prepnúť na tmavý režim"}
      title={mode === "dark" ? "Svetlý režim" : "Tmavý režim"}
    >
      {mode === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </Button>
  );
}
