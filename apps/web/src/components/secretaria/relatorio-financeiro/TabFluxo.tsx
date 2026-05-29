"use client";

import React from "react";
import { DespesaItem, FluxoMensalItem } from "./types";
import { kwanza, EducationalEmptyState } from "./utils";

interface TabFluxoProps {
  despesas: DespesaItem[];
  totalDespesas: number;
  totalEntradasResultado: number;
  totalSaidasResultado: number;
  saldoFinalResultado: number;
  fluxoMensalFiltrado: FluxoMensalItem[];
  anoLetivoAtivo: number;
  escolaId: string;
}

export function TabFluxo({
  despesas,
  totalDespesas,
  totalEntradasResultado,
  totalSaidasResultado,
  saldoFinalResultado,
  fluxoMensalFiltrado,
  anoLetivoAtivo,
  escolaId,
}: TabFluxoProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Saídas e Despesas</h2>
              <p className="text-xs text-slate-500">Resumo de débitos registrados.</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-slate-400">Total Despesas</p>
              <p className="text-lg font-bold text-rose-600">{kwanza.format(totalDespesas)}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[11px] leading-tight">
              <thead>
                <tr className="border-b bg-slate-50/50 text-left text-slate-500">
                  <th className="py-2 px-3 font-bold uppercase tracking-wider">Categoria</th>
                  <th className="py-2 px-3 text-right font-bold uppercase tracking-wider">Qtd</th>
                  <th className="py-2 px-3 text-right font-bold uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {despesas.map((d) => (
                  <tr key={d.label} className="hover:bg-slate-50/50">
                    <td className="py-1.5 px-3 font-medium text-slate-700">{d.label}</td>
                    <td className="py-1.5 px-3 text-right text-slate-500">{d.qtd}</td>
                    <td className="py-1.5 px-3 text-right font-bold text-rose-600">{kwanza.format(d.total)}</td>
                  </tr>
                ))}
                {despesas.length === 0 ? (
                  <EducationalEmptyState
                    colSpan={3}
                    title="Despesas ainda não lançadas"
                    message="Parece que você ainda não lançou as despesas deste mês."
                    ctaHref={`/escola/${escolaId}/secretaria`}
                    ctaLabel="Lançar agora"
                  />
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-emerald-900">Resultado do Período</h2>
            <p className="text-xs text-emerald-700">Balanço entre arrecadação e despesas.</p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
              <span className="text-sm text-emerald-800 font-medium">Total Entradas</span>
              <span className="font-bold text-emerald-700">{kwanza.format(totalEntradasResultado)}</span>
            </div>
            <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
              <span className="text-sm text-rose-800 font-medium">Total Saídas (Despesas)</span>
              <span className="font-bold text-rose-700">-{kwanza.format(totalSaidasResultado)}</span>
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-base font-bold text-slate-900">Saldo Final</span>
              <span className={`text-xl font-black ${saldoFinalResultado >= 0 ? "text-emerald-800" : "text-rose-800"}`}>
                {kwanza.format(saldoFinalResultado)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">Fluxo mensal ({anoLetivoAtivo})</h2>
          <p className="text-xs text-slate-500">Saldo anterior, entradas, saídas e saldo final.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[11px] leading-tight">
            <thead>
              <tr className="border-b bg-slate-50/50 text-left text-slate-500">
                <th className="sticky top-0 py-2 px-3 font-bold uppercase tracking-wider">Mês</th>
                <th className="sticky top-0 py-2 px-3 text-right font-bold uppercase tracking-wider">Saldo Ant.</th>
                <th className="sticky top-0 py-2 px-3 text-right font-bold uppercase tracking-wider">Entradas</th>
                <th className="sticky top-0 py-2 px-3 text-right font-bold uppercase tracking-wider">Saídas</th>
                <th className="sticky top-0 py-2 px-3 text-right font-bold uppercase tracking-wider">Dif.</th>
                <th className="sticky top-0 py-2 px-3 text-right font-bold uppercase tracking-wider">Saldo Final</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fluxoMensalFiltrado.map((item) => (
                <tr key={item.mesRef} className="hover:bg-slate-50/50">
                  <td className="py-1.5 px-3 font-medium text-slate-700">
                    {new Date(`${item.mesRef}T00:00:00`).toLocaleDateString("pt-PT", { month: "2-digit", year: "numeric" })}
                  </td>
                  <td className="py-1.5 px-3 text-right text-slate-600">{kwanza.format(item.saldoAnterior)}</td>
                  <td className="py-1.5 px-3 text-right text-emerald-700">{kwanza.format(item.entradasTotal)}</td>
                  <td className="py-1.5 px-3 text-right text-rose-700">{kwanza.format(item.saidasTotal)}</td>
                  <td className={`py-1.5 px-3 text-right font-medium ${item.diferenca >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {kwanza.format(item.diferenca)}
                  </td>
                  <td className={`py-1.5 px-3 text-right font-bold ${item.saldoFinal >= 0 ? "text-slate-900" : "text-rose-800"}`}>
                    {kwanza.format(item.saldoFinal)}
                  </td>
                </tr>
              ))}
              {fluxoMensalFiltrado.length === 0 ? (
                <EducationalEmptyState
                  colSpan={6}
                  title="Fluxo mensal indisponível"
                  message="Sem entradas e saídas consolidadas."
                  ctaHref={`/escola/${escolaId}/secretaria`}
                  ctaLabel="Atualizar fluxo"
                />
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
