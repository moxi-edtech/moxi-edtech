"use client";

import type { ChartsData } from "@/lib/charts";
import { WidgetEmpty, WidgetError, WidgetSkeleton } from "@/components/super-admin/WidgetStates";

type ChartData = { label: string; value: number };

type Props = {
  escolaId?: string;
  data?: ChartsData;
};

const STATUS_CONFIG: Record<string, { colorClass: string; label: string }> = {
  pago: { colorClass: "bg-klasse-green", label: "Pagos" },
  pendente: { colorClass: "bg-klasse-gold", label: "Pendentes" },
  em_atraso: { colorClass: "bg-red-600", label: "Em atraso" },
  cancelado: { colorClass: "bg-slate-400", label: "Cancelados" },
};

export default function ChartsSection({ escolaId, data }: Props) {
  if (!data && escolaId) {
    return <WidgetSkeleton lines={4} />;
  }

  if (!data) {
    return (
      <WidgetError
        title="Falha ao carregar fluxo financeiro"
        message="Não foi possível montar os gráficos de pagamentos para este contexto."
        nextStep="Verifique a view `vw_pagamentos_status` e atualize o painel."
      />
    );
  }

  const items: ChartData[] = data.pagamentos.map((item) => ({
    label: item.status ?? "desconhecido",
    value: Number(item.total ?? 0),
  }));

  const total = items.reduce((acc, item) => acc + item.value, 0);

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Fluxo de Pagamentos</h2>
            <p className="mt-1 text-sm text-slate-500">Visão consolidada de cobrança por status.</p>
          </div>
        </div>

        <div className="space-y-5">
          {items.length > 0 ? (
            items.map((payment) => {
              const config = STATUS_CONFIG[payment.label.toLowerCase()] ?? { colorClass: "bg-slate-400", label: payment.label };
              const pct = total > 0 ? (payment.value / total) * 100 : 0;

              return (
                <div key={payment.label}>
                  <div className="mb-2 flex items-end justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{config.label}</p>
                      <p className="text-2xl font-bold text-slate-950">{payment.value.toLocaleString()}</p>
                    </div>
                    <p className="text-sm font-medium text-slate-500">{pct.toFixed(1)}%</p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${config.colorClass}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })
          ) : (
            <WidgetEmpty
              title="Sem pagamentos no período"
              message="Não há linhas de pagamento para compor o gráfico agora."
              nextStep="Valide filtros de período/status ou execute refresh de dados financeiros."
            />
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-700">Saúde Financeira</p>
        <p className="mt-1 text-sm text-slate-500">Eficiência consolidada de adimplência.</p>
        <div className="mt-6 flex items-end gap-2">
          <span className="text-5xl font-bold text-klasse-green">{data.eficiencia ?? 0}</span>
          <span className="text-lg font-semibold text-slate-500">%</span>
        </div>
        <p className="mt-2 text-sm text-slate-500">Próximo passo: priorizar cobranças com risco alto.</p>
      </div>
    </section>
  );
}
