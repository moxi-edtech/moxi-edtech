"use client";

import { Moon, Sun } from "lucide-react";
import { useKlasseTheme } from "@/components/providers/ThemeProvider";

type Props = { className?: string; iconOnly?: boolean };

export default function ThemeToggle({ className = "", iconOnly = false }: Props) {
  const { mounted, isDark, setTheme } = useKlasseTheme();
  const label = !mounted ? "Tema" : isDark ? "Tema claro" : "Tema escuro";
  return (
    <button
      type="button"
      disabled={!mounted}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={[
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3",
        "text-sm font-medium text-foreground transition-colors hover:bg-muted",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber/20 disabled:opacity-60",
        className,
      ].join(" ")}
      aria-label={label}
      title={label}
    >
      {mounted && isDark ? <Sun className="h-4 w-4 shrink-0" aria-hidden /> : <Moon className="h-4 w-4 shrink-0" aria-hidden />}
      {!iconOnly && <span className="hidden sm:inline">{label}</span>}
    </button>
  );
}
