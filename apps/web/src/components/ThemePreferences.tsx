"use client";

import { Check, Laptop, Moon, Sun } from "lucide-react";
import { useKlasseTheme } from "@/components/providers/ThemeProvider";
import type { ThemePreference } from "@/lib/theme-preference";

const OPTIONS: ReadonlyArray<{ id: ThemePreference; label: string; Icon: typeof Sun }> = [
  { id: "light", label: "Claro", Icon: Sun },
  { id: "dark", label: "Escuro", Icon: Moon },
  { id: "system", label: "Sistema", Icon: Laptop },
];

export default function ThemePreferences() {
  const { preference, setTheme, mounted } = useKlasseTheme();
  return (
    <div role="radiogroup" aria-label="Aparência" className="space-y-1 px-1 py-1">
      <p className="px-2 pb-1 text-xs font-semibold text-muted-foreground">Aparência</p>
      {OPTIONS.map(({ id, label, Icon }) => {
        const active = mounted && preference === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={mounted && active ? 0 : -1}
            disabled={!mounted}
            onClick={() => setTheme(id)}
            onKeyDown={(event) => {
              const index = OPTIONS.findIndex((option) => option.id === id);
              let nextIndex = index;
              if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % OPTIONS.length;
              else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + OPTIONS.length) % OPTIONS.length;
              else if (event.key === "Home") nextIndex = 0;
              else if (event.key === "End") nextIndex = OPTIONS.length - 1;
              else return;
              event.preventDefault();
              setTheme(OPTIONS[nextIndex].id);
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus();
            }}
            className={[
              "flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-sm",
              "text-foreground transition-colors hover:bg-muted",
              "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber/20",
              active ? "bg-muted font-semibold" : "",
            ].join(" ")}
          >
            <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="flex-1 text-left">{label}</span>
            {active && <Check className="h-4 w-4 text-amber" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
