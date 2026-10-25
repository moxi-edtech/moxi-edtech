import { ThemeProvider } from "../src/components/providers/ThemeProvider";
import ThemeToggle from "../src/components/ThemeToggle";
import ThemePreferences from "../src/components/ThemePreferences";

/** Isolated, synthetic browser fixture for actual theme provider and controls. */
export default function ThemeSwitcherVisualFixture() {
  return (
    <ThemeProvider>
      <main className="min-h-screen bg-background p-6 text-foreground" data-testid="theme-surface">
        <div className="mx-auto max-w-md space-y-6 rounded-xl border border-border bg-card p-6">
          <h1 className="text-xl font-bold text-foreground">KLASSE · Aparência</h1>
          <p className="text-sm text-muted-foreground">Exemplo sintético de apresentação.</p>
          <ThemeToggle />
          <ThemePreferences />
          <div className="rounded-xl border border-border bg-muted p-4 text-foreground">
            A escolha do tema não altera os dados nem as permissões.
          </div>
        </div>
      </main>
    </ThemeProvider>
  );
}
