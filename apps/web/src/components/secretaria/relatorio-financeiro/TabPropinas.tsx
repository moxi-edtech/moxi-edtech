"use client";

import React, { useMemo, useState } from "react";
import { Mensal, PorTurma, InadimplenciaClasseItem } from "./types";
import { kwanza, formatMonthRef, normalizeMonthKey, EducationalEmptyState } from "./utils";
import { Search, Info } from "lucide-react";
import { FinancialDetailDrawer } from "./FinancialDetailDrawer";

interface TabPropinasProps {
  mensalFiltrado: Mensal[];
  rankingTurmasOrdenado: PorTurma[];
  inadimplenciaClasseFiltrada: InadimplenciaClasseItem[];
  selectedMonth: string;
  selectedMonthLabel: string;
  setSelectedMonth: (m: string) => void;
  anoLetivoAtivo: number;
  escolaId: string;
}

export function TabPropinas({
  mensalFiltrado,
  rankingTurmasOrdenado,
  inadimplenciaClasseFiltrada,
  selectedMonth,
  selectedMonthLabel,
  setSelectedMonth,
  anoLetivoAtivo,
  escolaId,
}: TabPropinasProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [drillDown, setDrillDown] = useState<{
    isOpen: boolean;
    classeId?: string;
    turmaId?: string;
    classeLabel: string;
    mes: string;
    ano: string;
    status: string;
  }>({
    isOpen: false,
    classeLabel: "",
    mes: "",
    ano: "",
    status: "pendente",
  });

  // Pivot Inadimplência: Linhas = Classe, Colunas = Mês
  const matrixData = useMemo(() => {
    // Pegar mapeamento de Classe Label para Classe ID
    const classIdMap: Record<string, string> = {};
    inadimplenciaClasseFiltrada.forEach(item => {
      classIdMap[item.classeLabel] = item.classeId;
    });

    const rawClasses = Array.from(new Set(inadimplenciaClasseFiltrada.map((item) => item.classeLabel)));
    const classes = rawClasses
      .filter((c) => c.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort();

    const months = Array.from(new Set(inadimplenciaClasseFiltrada.map((item) => normalizeMonthKey(item.mesRef)))).sort();

    const data: Record<string, Record<string, number>> = {};
    classes.forEach((c) => {
      data[c] = {};
      months.forEach((m) => {
        data[c][m] = 0;
      });
    });

    inadimplenciaClasseFiltrada.forEach((item) => {
      const mKey = normalizeMonthKey(item.mesRef);
      if (data[item.classeLabel]) {
        data[item.classeLabel][mKey] += item.totalEmAtraso;
      }
    });

    return { classes, months, data, classIdMap };
  }, [inadimplenciaClasseFiltrada, searchTerm]);

  const handleOpenDrillDown = (options: { 
    classeLabel?: string; 
    classeId?: string;
    turmaId?: string;
    turmaNome?: string;
    monthKey: string; 
    status?: string 
  }) => {
    const [ano, mes] = options.monthKey.split("-");

    setDrillDown({
      isOpen: true,
      classeId: options.classeId || (options.classeLabel ? matrixData.classIdMap[options.classeLabel] : undefined),
      turmaId: options.turmaId,
      classeLabel: options.turmaNome || options.classeLabel || "Todas as Classes",
      mes,
      ano,
      status: options.status || "pendente"
    });
  };

  const rankingFiltrado = useMemo(() => {
    if (!searchTerm) return rankingTurmasOrdenado;
    return rankingTurmasOrdenado.filter(
      (t) => 
        t.turmaNome.toLowerCase().includes(searchTerm.toLowerCase()) || 
        t.classe?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [rankingTurmasOrdenado, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Barra de Pesquisa Local */}
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Pesquisar por classe ou turma (ex: 7ª Classe, Turma A)..."
          className="flex-1 text-sm outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">Série mensal ({anoLetivoAtivo})</h2>
          <p className="text-xs text-slate-500">Leitura por competência e arrecadação.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[11px] leading-tight">
            <thead>
              <tr className="border-b bg-slate-50/50 text-left text-slate-500">
                <th className="sticky top-0 py-2 px-3 font-bold uppercase tracking-wider">Competência</th>
                <th className="sticky top-0 py-2 px-3 text-right font-bold uppercase tracking-wider">Mens.</th>
                <th className="sticky top-0 py-2 px-3 text-right font-bold uppercase tracking-wider">Atraso</th>
                <th className="sticky top-0 py-2 px-3 text-right font-bold uppercase tracking-wider">Previsto</th>
                <th className="sticky top-0 py-2 px-3 text-right font-bold uppercase tracking-wider">Pago</th>
                <th className="sticky top-0 py-2 px-3 text-right font-bold uppercase tracking-wider">Total Atraso</th>
                <th className="sticky top-0 py-2 px-3 text-right font-bold uppercase tracking-wider">Inad. %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mensalFiltrado.map((m) => {
                const mKey = `${m.ano}-${String(m.mes).padStart(2, "0")}`;
                return (
                  <tr key={`${m.ano}-${m.mes}`} className="hover:bg-slate-50/50">
                    <td className="py-1.5 px-3 font-medium text-slate-700">{m.labelMes}</td>
                    <td className="py-1.5 px-3 text-right text-slate-600">{m.qtdMensalidades}</td>
                    <td className="py-1.5 px-3 text-right text-rose-600">{m.qtdEmAtraso}</td>
                    <td className="py-1.5 px-3 text-right text-slate-600">{kwanza.format(m.totalPrevisto)}</td>
                    <td 
                      className={`py-1.5 px-3 text-right text-emerald-600 font-medium ${m.totalPago > 0 ? "cursor-pointer hover:underline" : ""}`}
                      onClick={() => m.totalPago > 0 && handleOpenDrillDown({ monthKey: mKey, status: "pago" })}
                    >
                      {kwanza.format(m.totalPago)}
                    </td>
                    <td 
                      className={`py-1.5 px-3 text-right text-rose-700 font-bold ${m.totalEmAtraso > 0 ? "cursor-pointer hover:underline" : ""}`}
                      onClick={() => m.totalEmAtraso > 0 && handleOpenDrillDown({ monthKey: mKey, status: "pendente" })}
                    >
                      {kwanza.format(m.totalEmAtraso)}
                    </td>
                    <td className="py-1.5 px-3 text-right font-medium">{m.inadimplenciaPct.toFixed(1)}%</td>
                  </tr>
                );
              })}
              {mensalFiltrado.length === 0 ? (
                <EducationalEmptyState
                  colSpan={7}
                  title="Nenhuma competência encontrada"
                  message={`Não há dados para ${selectedMonthLabel.toLowerCase()}.`}
                  ctaHref={`/escola/${escolaId}/secretaria`}
                  ctaLabel="Revisar lançamentos"
                />
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">Inadimplência por Classe (Matriz)</h2>
          <p className="text-xs text-slate-500">Visão matricial de valores em atraso por mês e classe.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-50 text-slate-500">
                <th className="sticky left-0 z-10 bg-slate-50 border-b border-r py-2 px-3 text-left font-bold uppercase tracking-wider">Classe</th>
                {matrixData.months.map((m) => (
                  <th key={m} className="border-b py-2 px-3 text-right font-bold uppercase tracking-wider">
                    {formatMonthRef(m)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {matrixData.classes.map((c) => (
                <tr key={c} className="hover:bg-slate-50/50">
                  <td className="sticky left-0 z-10 bg-white border-r py-1.5 px-3 font-medium text-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                    {c}
                  </td>
                  {matrixData.months.map((m) => {
                    const val = matrixData.data[c][m];
                    return (
                      <td 
                        key={m} 
                        className={`py-1.5 px-3 text-right group relative ${val > 0 ? "text-rose-600 font-bold cursor-pointer hover:bg-rose-50" : "text-slate-300"}`}
                        onClick={() => val > 0 && handleOpenDrillDown({ classeLabel: c, monthKey: m })}
                        title={val > 0 ? `Clique para ver os alunos em atraso da ${c} em ${formatMonthRef(m)}` : ""}
                      >
                        {val > 0 ? kwanza.format(val) : "—"}
                        {val > 0 && (
                          <div className="absolute top-0 right-0 hidden group-hover:flex">
                            <Info className="h-2.5 w-2.5 text-rose-400" />
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {matrixData.classes.length === 0 ? (
                <EducationalEmptyState
                  colSpan={matrixData.months.length + 1}
                  title="Nenhum dado de inadimplência"
                  message="Parece estar tudo em dia ou os dados ainda não foram carregados."
                  ctaHref={`/escola/${escolaId}/secretaria`}
                  ctaLabel="Voltar para secretaria"
                />
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">Ranking por turma ({anoLetivoAtivo})</h2>
          <p className="text-xs text-slate-500">Ordenado por maior atraso.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[11px] leading-tight">
            <thead>
              <tr className="border-b bg-slate-50/50 text-left text-slate-500">
                <th className="sticky top-0 py-2 px-3 font-bold uppercase tracking-wider">Turma</th>
                <th className="sticky top-0 py-2 px-3 text-right font-bold uppercase tracking-wider">Mens.</th>
                <th className="sticky top-0 py-2 px-3 text-right font-bold uppercase tracking-wider">Atraso</th>
                <th className="sticky top-0 py-2 px-3 text-right font-bold uppercase tracking-wider">Pago</th>
                <th className="sticky top-0 py-2 px-3 text-right font-bold uppercase tracking-wider">Total Atraso</th>
                <th className="sticky top-0 py-2 px-3 text-right font-bold uppercase tracking-wider">Inad. %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rankingFiltrado.map((t) => (
                <tr key={t.turmaId} className="hover:bg-slate-50/50">
                  <td className="py-1.5 px-3 font-medium text-slate-700">{t.turmaNome}</td>
                  <td className="py-1.5 px-3 text-right text-slate-600">{t.qtdMensalidades}</td>
                  <td className="py-1.5 px-3 text-right text-rose-600">{t.qtdEmAtraso}</td>
                  <td className="py-1.5 px-3 text-right text-emerald-700 font-bold">
                    {kwanza.format(t.totalPago + t.totalPagoAdiantado)}
                  </td>
                  <td 
                    className={`py-1.5 px-3 text-right text-rose-700 font-bold ${t.totalEmAtraso > 0 ? "cursor-pointer hover:underline" : ""}`}
                    onClick={() => {
                      if (t.totalEmAtraso > 0) {
                        // Se houver mês selecionado no filtro global, usamos ele, senão pegamos o ano completo?
                        // O drill-down precisa de um mês/ano. Se "all", talvez mostrar o mês mais crítico da turma?
                        // Por simplicidade, vamos usar o selectedMonth se != "all", senão o mês mais recente?
                        const mKey = selectedMonth !== "all" ? selectedMonth : `${anoLetivoAtivo}-12`; // fallback para fim do ano
                        handleOpenDrillDown({ turmaId: t.turmaId, turmaNome: t.turmaNome, monthKey: mKey });
                      }
                    }}
                  >
                    {kwanza.format(t.totalEmAtraso)}
                  </td>
                  <td className="py-1.5 px-3 text-right font-medium">{t.inadimplenciaPct.toFixed(1)}%</td>
                </tr>
              ))}
              {rankingFiltrado.length === 0 ? (
                <EducationalEmptyState
                  colSpan={6}
                  title="Ranking por turma indisponível"
                  message="Ainda não há massa crítica para comparar turmas."
                  ctaHref={`/escola/${escolaId}/secretaria`}
                  ctaLabel="Ver secretaria"
                />
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <FinancialDetailDrawer
        isOpen={drillDown.isOpen}
        onClose={() => setDrillDown((prev) => ({ ...prev, isOpen: false }))}
        escolaId={escolaId}
        classeId={drillDown.classeId}
        classeLabel={drillDown.classeLabel}
        mes={drillDown.mes}
        ano={drillDown.ano}
        status={drillDown.status}
      />
    </div>
  );
}
