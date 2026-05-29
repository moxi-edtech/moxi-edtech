"use client";

import React, { useMemo, useState } from "react";
import { Search, Info } from "lucide-react";
import { FinancialDetailDrawer } from "./FinancialDetailDrawer";
import { CaptacaoItem } from "./types";
import { EducationalEmptyState } from "./utils";

interface TabCaptacaoProps {
  captacao: CaptacaoItem[];
  escolaId: string;
  anoLetivoAtivo: number;
}

export function TabCaptacao({ captacao, escolaId, anoLetivoAtivo }: TabCaptacaoProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [drillDown, setDrillDown] = useState<{
    isOpen: boolean;
    classeId: string;
    classeLabel: string;
    source: "matriculas";
    type: "matricula" | "confirmacao" | "bolsista";
  }>({
    isOpen: false,
    classeId: "",
    classeLabel: "",
    source: "matriculas",
    type: "matricula",
  });

  const captacaoFiltrada = useMemo(() => {
    if (!searchTerm) return captacao;
    return captacao.filter((c) => c.label.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [captacao, searchTerm]);

  const handleOpenDrillDown = (classeLabel: string, type: "matricula" | "confirmacao" | "bolsista") => {
    // Para captacao, não temos o ID da classe diretamente no array de items mas temos o label.
    // Como a API de captacao retorna itens com label, vamos passar o label e deixar o drawer resolver se precisar.
    // Na verdade, seria melhor ter o ID. Vamos assumir que a API de drill-down pode aceitar o label se o ID for chato de pegar agora,
    // mas já atualizamos a API para aceitar classe_id.
    // TODO: Ajustar TabCaptacao para receber classeId no objeto CaptacaoItem.
    
    setDrillDown({
      isOpen: true,
      classeId: "", // Será buscado por label no drawer ou via ajuste no tipo
      classeLabel,
      source: "matriculas",
      type
    });
  };

  return (
    <div className="space-y-4">
      {/* Barra de Pesquisa Local */}
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Pesquisar por classe (ex: 10ª Classe)..."
          className="flex-1 text-sm outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Bloco de Captação Acadêmica */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">Captação por Classe</h2>
            <p className="text-xs text-slate-500">Matrículas e confirmações efetuadas no ano.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[11px] leading-tight">
              <thead>
                <tr className="border-b bg-slate-50/50 text-left text-slate-500">
                  <th className="sticky top-0 py-2 px-3 font-bold uppercase tracking-wider">Classe</th>
                  <th className="sticky top-0 py-2 px-3 text-right font-bold uppercase tracking-wider">Matrículas</th>
                  <th className="sticky top-0 py-2 px-3 text-right font-bold uppercase tracking-wider">Confirmações</th>
                  <th className="sticky top-0 py-2 px-3 text-right font-bold uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {captacaoFiltrada.map((c) => (
                  <tr key={c.label} className="hover:bg-slate-50/50">
                    <td className="py-1.5 px-3 font-medium text-slate-700">{c.label}</td>
                    <td 
                      className={`py-1.5 px-3 text-right text-slate-600 ${c.matriculas > 0 ? "cursor-pointer hover:underline hover:text-indigo-600" : ""}`}
                      onClick={() => c.matriculas > 0 && handleOpenDrillDown(c.label, "matricula")}
                    >
                      {c.matriculas}
                    </td>
                    <td 
                      className={`py-1.5 px-3 text-right text-slate-600 ${c.confirmacoes > 0 ? "cursor-pointer hover:underline hover:text-indigo-600" : ""}`}
                      onClick={() => c.confirmacoes > 0 && handleOpenDrillDown(c.label, "confirmacao")}
                    >
                      {c.confirmacoes}
                    </td>
                    <td className="py-1.5 px-3 text-right font-bold text-slate-900">{c.total}</td>
                  </tr>
                ))}
                {captacaoFiltrada.length === 0 ? (
                  <EducationalEmptyState
                    colSpan={4}
                    title="Captação não encontrada"
                    message="Nenhuma classe corresponde à sua pesquisa."
                    ctaHref={`/escola/${escolaId}/secretaria`}
                    ctaLabel="Ver tudo"
                  />
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bloco de Bolsistas */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">Inscritos e Bolsistas</h2>
            <p className="text-xs text-slate-500">Resumo de alunos com benefícios ou descontos.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[11px] leading-tight">
              <thead>
                <tr className="border-b bg-slate-50/50 text-left text-slate-500">
                  <th className="sticky top-0 py-2 px-3 font-bold uppercase tracking-wider">Classe</th>
                  <th className="sticky top-0 py-2 px-3 text-right font-bold uppercase tracking-wider">Alunos</th>
                  <th className="sticky top-0 py-2 px-3 text-right font-bold uppercase tracking-wider">Bolsistas</th>
                  <th className="sticky top-0 py-2 px-3 text-right font-bold uppercase tracking-wider">% Bolsistas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {captacaoFiltrada.map((c) => (
                  <tr key={`${c.label}-bolsas`} className="hover:bg-slate-50/50">
                    <td className="py-1.5 px-3 font-medium text-slate-700">{c.label}</td>
                    <td className="py-1.5 px-3 text-right text-slate-600">{c.total}</td>
                    <td 
                      className={`py-1.5 px-3 text-right text-blue-600 font-medium ${c.bolsistas > 0 ? "cursor-pointer hover:underline" : ""}`}
                      onClick={() => c.bolsistas > 0 && handleOpenDrillDown(c.label, "bolsista")}
                    >
                      {c.bolsistas}
                    </td>
                    <td className="py-1.5 px-3 text-right">
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                        {c.total > 0 ? ((c.bolsistas / c.total) * 100).toFixed(1) : "0.0"}%
                      </span>
                    </td>
                  </tr>
                ))}
                {captacaoFiltrada.length === 0 ? (
                  <EducationalEmptyState
                    colSpan={4}
                    title="Dados não encontrados"
                    message="Nenhuma informação corresponde aos filtros aplicados."
                    ctaHref={`/escola/${escolaId}/secretaria`}
                    ctaLabel="Limpar busca"
                  />
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <FinancialDetailDrawer
        isOpen={drillDown.isOpen}
        onClose={() => setDrillDown((prev) => ({ ...prev, isOpen: false }))}
        escolaId={escolaId}
        classeLabel={drillDown.classeLabel}
        ano={String(anoLetivoAtivo)}
        source={drillDown.source}
        type={drillDown.type}
      />
    </div>
  );
}
