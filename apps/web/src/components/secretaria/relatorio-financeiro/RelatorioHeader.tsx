"use client";

import React from "react";
import { Printer, Download, FileSpreadsheet, FileText, Activity } from "lucide-react";
import { SessionItem } from "./types";

interface RelatorioHeaderProps {
  boardMode: boolean;
  setBoardMode: (val: boolean | ((prev: boolean) => boolean)) => void;
  healthScore: number;
  sessions: SessionItem[];
  selectedSession: string;
  setSelectedSession: (id: string) => void;
  onPrint: () => void;
  onExportCsv: () => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
}

export function RelatorioHeader({
  boardMode,
  setBoardMode,
  healthScore,
  sessions,
  selectedSession,
  setSelectedSession,
  onPrint,
  onExportCsv,
  onExportExcel,
  onExportPdf,
}: RelatorioHeaderProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:rounded-none print:border-none print:p-0 print:shadow-none sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900 print:text-3xl">
            {boardMode ? "Painel Executivo Financeiro" : "Relatório de Mensalidades"}
          </h1>
          {!boardMode && (
            <div
              className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider sm:flex ${
                healthScore >= 80
                  ? "bg-emerald-100 text-emerald-700"
                  : healthScore >= 50
                  ? "bg-amber-100 text-amber-700"
                  : "bg-rose-100 text-rose-700"
              }`}
            >
              <Activity className="h-3 w-3" />
              Saúde: {healthScore}%
            </div>
          )}
        </div>
        <p className="text-sm text-slate-500 print:text-slate-600">
          {boardMode
            ? "Leitura limpa para diretoria, TV ou tablet, com foco em KPIs e sinais do período."
            : "Resumo imprimível das propinas por período e por turma."}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <label className="text-sm text-slate-600">Sessão</label>
        <select
          value={selectedSession}
          onChange={(e) => setSelectedSession(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setBoardMode((current) => !current)}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
            boardMode
              ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          {boardMode ? "Sair do modo diretoria" : "Modo diretoria"}
        </button>
        <button
          type="button"
          onClick={onPrint}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Printer className="h-4 w-4" />
          Imprimir
        </button>
        <button
          type="button"
          onClick={onExportCsv}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </button>
        <button
          type="button"
          onClick={onExportExcel}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Exportar Excel
        </button>
        <button
          type="button"
          onClick={onExportPdf}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <FileText className="h-4 w-4" />
          Exportar PDF
        </button>
      </div>
    </div>
  );
}
