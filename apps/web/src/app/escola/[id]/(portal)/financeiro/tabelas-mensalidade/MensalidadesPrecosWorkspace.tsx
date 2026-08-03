"use client";

import { useEffect, useState } from "react";
import { CalendarRange, GraduationCap } from "lucide-react";

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
    <main className="space-y-6 p-4 md:p-6">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Financeiro
        </p>
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
          Mensalidades e preços
        </h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Configure mensalidades por ano letivo e regras de matrícula e propina por curso ou classe.
        </p>
      </header>

      <nav
        aria-label="Configuração de mensalidades e preços"
        className="grid gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:grid-cols-2"
      >
        <button
          type="button"
          aria-current={view === "mensalidades" ? "page" : undefined}
          onClick={() => selectView("mensalidades")}
          className={`flex items-start gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
            view === "mensalidades"
              ? "bg-slate-900 text-white"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          <CalendarRange className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            <span className="block text-sm font-semibold">Tabelas de mensalidades</span>
            <span className={`mt-0.5 block text-xs ${view === "mensalidades" ? "text-slate-300" : "text-slate-500"}`}>
              Valores e vencimentos por ano letivo.
            </span>
          </span>
        </button>

        <button
          type="button"
          aria-current={view === "precos" ? "page" : undefined}
          onClick={() => selectView("precos")}
          className={`flex items-start gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
            view === "precos"
              ? "bg-slate-900 text-white"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          <GraduationCap className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            <span className="block text-sm font-semibold">Matrícula e propina</span>
            <span className={`mt-0.5 block text-xs ${view === "precos" ? "text-slate-300" : "text-slate-500"}`}>
              Regras por curso e classe, com aplicação a pendências.
            </span>
          </span>
        </button>
      </nav>

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          A carregar configurações financeiras…
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
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6"
        >
          <PrecosClient escolaId={escolaId} embedded />
        </section>
      )}
    </main>
  );
}
