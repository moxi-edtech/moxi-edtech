"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type ThemeToggleProps = {
  className?: string;
  /** Quando true, mostra apenas o ícone (útil na sidebar colapsada ou topbar). */
  iconOnly?: boolean;
};

export default function ThemeToggle({ className, iconOnly = true }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Evita mismatch de hidratação — só renderiza depois do mount no cliente
  if (!mounted) {
    return (
      <button
        type="button"
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground",
          className,
        )}
        aria-label="Alternar tema"
        disabled
      >
        <Sun className="h-4 w-4 opacity-40" aria-hidden />
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card text-muted-foreground transition",
        "hover:bg-muted hover:text-foreground",
        "focus:outline-none focus:ring-4 focus:ring-amber/20",
        iconOnly ? "h-10 w-10" : "h-10 px-3 text-sm font-medium",
        className,
      )}
      aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      title={isDark ? "Tema claro" : "Tema escuro"}
    >
      {isDark ? (
        <Sun className="h-4 w-4" aria-hidden />
      ) : (
        <Moon className="h-4 w-4" aria-hidden />
      )}
      {!iconOnly && <span>{isDark ? "Claro" : "Escuro"}</span>}
    </button>
  );
}
