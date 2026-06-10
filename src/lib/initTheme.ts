const THEME_KEY = "theme";

/** Apply saved theme before first paint. Default: dark (:root without .light). */
export function initTheme(): void {
  if (typeof document === "undefined") return;
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light") {
    document.documentElement.classList.add("light");
  } else {
    document.documentElement.classList.remove("light");
  }
}

export function setTheme(mode: "light" | "dark"): void {
  if (mode === "light") {
    document.documentElement.classList.add("light");
    localStorage.setItem(THEME_KEY, "light");
  } else {
    document.documentElement.classList.remove("light");
    localStorage.setItem(THEME_KEY, "dark");
  }
}

export function getTheme(): "light" | "dark" {
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}
