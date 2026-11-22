import { useState } from "react";
import { ThemeProvider } from "../src/components/providers/ThemeProvider";
import ThemeToggle from "../src/components/ThemeToggle";
import ThemePreferences from "../src/components/ThemePreferences";

/**
 * Synthetic visual contract exercising the real theme provider and KLASSE
 * design tokens. It never requests or represents data from a real school.
 */
export default function ThemeSwitcherVisualFixture() {
  const [detailsOpen, setDetailsOpen] = useState(false);
  return (
    <ThemeProvider>
      <main className="min-h-screen w-full min-w-0 bg-background p-3 text-foreground sm:p-6" data-testid="theme-surface">
        <div className="mx-auto max-w-5xl space-y-5">
          <div className="rounded-xl border border-border bg-card p-4 sm:p-6" data-testid="operations-card">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-foreground">KLASSE · Aparência operacional</h1>
                <p className="text-sm text-muted-foreground">Dados sintéticos para homologação de tema.</p>
              </div>
              <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
                <ThemeToggle />
                <ThemePreferences />
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-border bg-muted p-3 text-foreground" data-testid="operations-muted">
              A escolha do tema não altera notas, pagamentos ou permissões.
            </div>
          </div>

          <section aria-label="Indicadores e estado financeiro" className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <article className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm" data-testid="operations-stat">
              <p className="text-sm text-muted-foreground">Matrículas confirmadas</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">128</p>
            </article>
            <article className="min-w-0 rounded-xl border border-border bg-rose-50 p-4 text-rose-900 shadow-sm dark:border-rose-900/50 dark:bg-rose-950 dark:text-rose-100"
              data-testid="operations-overdue">
              <p className="text-sm font-semibold">Propinas vencidas</p>
              <p className="mt-1 text-xl font-bold">5.000 Kz</p>
            </article>
            <article className="min-w-0 rounded-xl border border-border bg-emerald-50 p-4 text-emerald-900 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950 dark:text-emerald-100"
              data-testid="operations-success">
              <p className="text-sm font-semibold">Pagamento confirmado</p>
              <p className="mt-1 text-xl font-bold">2.000 Kz</p>
            </article>
          </section>

          <section className="min-w-0 rounded-xl border border-border bg-card p-3 sm:p-5" data-testid="operations-table-card">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-foreground">Turmas · Estado académico</h2>
              <button type="button" onClick={() => setDetailsOpen(true)}
                className="rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-klasse-gold-900 hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-klasse-gold"
                data-testid="operations-open-modal">
                Ver situação
              </button>
            </div>
            <div className="min-w-0 max-w-full overflow-x-auto rounded-xl border border-border" data-testid="operations-table-scroll">
              <table className="w-full min-w-[540px] border-collapse bg-card text-sm text-foreground" data-testid="operations-table">
                <thead className="bg-muted text-foreground">
                  <tr>
                    <th scope="col" className="p-3 text-left font-semibold">Aluno</th>
                    <th scope="col" className="p-3 text-left font-semibold">Turma</th>
                    <th scope="col" className="p-3 text-left font-semibold">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card text-foreground">
                  <tr><td className="p-3">Aluno de exemplo A</td><td className="p-3">6.ª A</td>
                    <td className="p-3"><span className="font-semibold text-rose-800 dark:text-rose-300">Por regularizar</span></td></tr>
                  <tr><td className="p-3">Aluno de exemplo B</td><td className="p-3">5.ª B</td>
                    <td className="p-3"><span className="font-semibold text-emerald-800 dark:text-emerald-300">Concluída</span></td></tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
        {detailsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6"
            data-testid="operations-backdrop">
            <section role="dialog" aria-modal="true" aria-labelledby="operations-modal-title"
              className="w-full max-w-md rounded-xl border border-border bg-card p-5 text-foreground shadow-xl"
              data-testid="operations-modal">
              <h2 id="operations-modal-title" className="text-lg font-semibold">Situação financeira</h2>
              <p className="mt-2 text-sm text-muted-foreground">Verificação sintética de contraste e responsividade.</p>
              <p className="mt-3 rounded-xl border border-border bg-muted p-3 text-foreground"
                data-testid="operations-modal-content">Nenhum dado real é apresentado.</p>
              <button type="button" onClick={() => setDetailsOpen(false)}
                className="mt-4 rounded-xl border border-border bg-card px-4 py-2 font-semibold text-foreground hover:bg-muted"
                data-testid="operations-close-modal">Fechar</button>
            </section>
          </div>
        )}
      </main>
    </ThemeProvider>
  );
}
