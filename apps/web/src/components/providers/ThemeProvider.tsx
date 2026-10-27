"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { parseThemePreference, resolveDarkTheme, type ThemePreference } from "@/lib/theme-preference";

const STORAGE_KEY = "klasse-theme";
type ThemeContextValue = {
  preference: ThemePreference;
  isDark: boolean;
  mounted: boolean;
  setTheme: (theme: ThemePreference) => void;
};
const ThemeContext = createContext<ThemeContextValue | null>(null);

function readPreference(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem("theme"));
  } catch {
    return "system";
  }
}

function applyTheme(preference: ThemePreference): boolean {
  const dark = resolveDarkTheme(preference, window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  return dark;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setPreference(readPreference());
    setMounted(true);
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === "theme" || event.key === null) {
        setPreference(readPreference());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const sync = () => setIsDark(applyTheme(preference));
    sync();
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [mounted, preference]);

  const setTheme = useCallback((next: ThemePreference) => {
    const value = parseThemePreference(next);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Continuar sem persistência se localStorage estiver indisponível.
    }
    setPreference(value);
    setIsDark(applyTheme(value));
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, isDark, mounted, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useKlasseTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("ThemeToggle requer ThemeProvider");
  return context;
}
