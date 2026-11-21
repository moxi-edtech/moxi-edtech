"use client";

import { useEffect, useState } from "react";
import { CalendarRange, GraduationCap } from "lucide-react";
import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";

import TabelasMensalidadeClient from "@/components/financeiro/TabelasMensalidadeClient";
import PrecosClient from "@/app/escola/[id]/(portal)/financeiro/configuracoes/precos/PrecosClient";
import { useEscolaId } from "@/hooks/useEscolaId";

type WorkspaceView = "mensalidades" | "precos";

const isWorkspaceView = (value: string | null): value is WorkspaceView =>
  value === "mensalidades" || value === "precos";

export default function MensalidadesPrecosWorkspace({
  initialView = "mensalidades",
}: {
  initialView?: WorkspaceView;
}) {
  const { escolaId, isLoading, error } = useEscolaId();
  const [view, setView] = useState<WorkspaceView>(initialView);

  useEffect(() => {
    const requestedView = new URLSearchParams(window.location.search).get("view");
    if (!isWorkspaceView(requestedView) || requestedView === view) return;

    const frame = window.requestAnimationFrame(() => setView(requestedView));
    return () => window.cancelAnimationFrame(frame);
  }, [view]);

  const selectView = (nextView: WorkspaceView) => {
    setView(nextView);
    const url = new URL(window.location.href);
    url.searchParams.set("view", nextView);
    window.history.replaceState(null, "", url);
  };

  return (
    <div className={`${PORTAL_PAGE_INSET} space-y-6`}>
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Financeiro
        </p>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">
          Mensalidades e preços
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Configure mensalidades por ano letivo e regras de matrícula e propina por curso ou classe.
        </p>
      </header>

      <nav
        aria-label="Configuração de mensalidades e preços"
        className="grid gap-2 rounded-xl border border-border bg-card p-2 shadow-sm sm:grid-cols-2"
      >
        <button
          type="button"
          aria-pressed={view === "mensalidades"}
          onClick={() => selectView("mensalidades")}
          className={`flex min-w-0 items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 ${
            view === "mensalidades"
              ? "border-klasse-gold/50 bg-klasse-gold/10 text-foreground"
              : "border-transparent text-muted-foreground hover:bg-muted"
          }`}
        >
          <CalendarRange className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            <span className="block text-sm font-semibold">Tabelas de mensalidades</span>
            <span className={`mt-0.5 block text-xs ${view === "mensalidades" ? "text-foreground" : "text-muted-foreground"}`}>
              Valores e vencimentos por ano letivo.
            </span>
          </span>
        </button>

        <button
          type="button"
          aria-pressed={view === "precos"}
          onClick={() => selectView("precos")}
          className={`flex min-w-0 items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 ${
            view === "precos"
              ? "border-klasse-gold/50 bg-klasse-gold/10 text-foreground"
              : "border-transparent text-muted-foreground hover:bg-muted"
          }`}
        >
          <GraduationCap className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            <span className="block text-sm font-semibold">Matrícula e propina</span>
            <span className={`mt-0.5 block text-xs ${view === "precos" ? "text-foreground" : "text-muted-foreground"}`}>
              Regras por curso e classe, com aplicação a pendências.
            </span>
          </span>
        </button>
      </nav>

      {isLoading ? (
        <div role="status" aria-busy="true" aria-label="A carregar configurações financeiras" className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-6">
          <span className="sr-only">A carregar configurações financeiras</span>
          <div aria-hidden="true" className="h-4 w-48 max-w-full rounded-xl bg-muted motion-safe:animate-pulse" />
          <div aria-hidden="true" className="h-24 w-full rounded-xl bg-muted motion-safe:animate-pulse" />
        </div>
      ) : error || !escolaId ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          Não foi possível identificar a escola para carregar mensalidades e preços.
        </div>
      ) : view === "mensalidades" ? (
        <section aria-label="Tabelas de mensalidades">
          <TabelasMensalidadeClient escolaId={escolaId} />
        </section>
      ) : (
        <section
          aria-label="Regras de matrícula e propina"
          className="rounded-xl border border-border bg-card p-4 shadow-sm md:p-6"
        >
          <PrecosClient escolaId={escolaId} embedded />
        </section>
      )}
    </div>
  );
}
