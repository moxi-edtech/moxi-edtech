import React, { useState } from "react";
import { ImprimirListaTurmaButton } from "../src/components/secretaria/ImprimirListaTurmaButton";

const turmaA = "00000000-0000-4000-8000-000000000701";
const turmaB = "00000000-0000-4000-8000-000000000702";

/**
 * São componentes React reais para a impressão directa, servidos apenas no
 * visual-harness, com nomes/IDs fictícios. Não simula autenticação nem RLS.
 */
export default function RosterExportVisualFixture() {
  const [retry, setRetry] = useState(false);
  return (
    <main id="roster-export-fixture" className="min-h-screen min-w-0 overflow-x-hidden bg-background px-3 py-5 text-foreground sm:px-5">
      <div className="mx-auto w-full max-w-5xl min-w-0 space-y-5">
        <header className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">TESTE VISUAL · DADOS INTEIRAMENTE SINTÉTICOS</p>
          <h1 className="text-2xl font-bold text-foreground">Listas de turmas</h1>
          <p className="text-sm text-muted-foreground">Escola Fictícia A · Ano letivo 2025/2026 · Lista do ano letivo (histórica)</p>
        </header>

        <section aria-label="Cartões de turmas" className="min-w-0">
          <h2 className="mb-3 text-sm font-bold text-foreground">Cartões das turmas</h2>
          <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
            <article className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-sm font-bold">7.ª Classe · Turma A</p>
              <p className="mt-1 text-xs text-muted-foreground">41 matrículas históricas · Período encerrado</p>
              <div className="mt-4"><ImprimirListaTurmaButton turmaId={turmaA} /></div>
            </article>
            <article className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-sm font-bold">7.ª Classe · Turma B</p>
              <p className="mt-1 text-xs text-muted-foreground">55 matrículas históricas · Período encerrado</p>
              <div className="mt-4"><ImprimirListaTurmaButton turmaId={turmaB} /></div>
            </article>
          </div>
        </section>

        <section aria-label="Tabela de turmas" className="min-w-0 rounded-xl border border-border bg-card p-3 sm:p-4">
          <h2 className="text-sm font-bold">Tabela de turmas</h2>
          <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">8.ª Classe · Turma A</p>
              <p className="text-xs text-muted-foreground">Ano letivo 2025/2026</p>
            </div>
            <ImprimirListaTurmaButton turmaId="00000000-0000-4000-8000-000000000703" />
          </div>
        </section>

        <section aria-label="Impressão em lote" className="min-w-0 rounded-xl border border-border bg-card p-3 sm:p-4">
          <h2 className="text-sm font-bold">Impressão em lote</h2>
          <p className="mt-1 text-xs text-muted-foreground">2 turmas seleccionadas · ZIP consolidado</p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-full bg-primary" />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold">{retry ? "A reprocessar turmas com falha…" : "Concluído com falhas — 1 de 2"}</p>
            <button type="button" onClick={() => setRetry(true)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted">
              {retry ? "Em progresso" : "Reprocessar turmas com falha"}
            </button>
          </div>
          <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
            <li className="flex flex-wrap items-center justify-between gap-2">
              <span>7.ª A · Ficheiro nominal</span><strong className="text-foreground">Concluído</strong>
            </li>
            <li className="flex flex-wrap items-center justify-between gap-2">
              <span>7.ª B · Ficheiro nominal</span><strong className="text-foreground">{retry ? "Na fila" : "Falhou"}</strong>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
