"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { isLightOnlyPortalPath, parseThemePreference, resolveDarkTheme, type ThemePreference } from "@/lib/theme-preference";
import { usePathname } from "next/navigation";

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

function applyTheme(preference: ThemePreference, lightOnlyPortal: boolean): boolean {
  const dark = !lightOnlyPortal && resolveDarkTheme(preference, window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  return dark;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const lightOnlyPortal = isLightOnlyPortalPath(pathname);
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

  // On client-side navigation, switch themes before the new portal paints.
  useLayoutEffect(() => {
    if (!mounted) return;
    const sync = () => setIsDark(applyTheme(preference, lightOnlyPortal));
    sync();
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [mounted, preference, lightOnlyPortal]);

  const setTheme = useCallback((next: ThemePreference) => {
    const value = parseThemePreference(next);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Continuar sem persistência se localStorage estiver indisponível.
    }
    setPreference(value);
    setIsDark(applyTheme(value, lightOnlyPortal));
  }, [lightOnlyPortal]);

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
