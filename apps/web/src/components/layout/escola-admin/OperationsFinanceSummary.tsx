"use client";

import { Info } from "lucide-react";

type Props = {
  recebido: number;
  previsto: number;
  liquidadoCompetencia: number;
  mensalidades: number;
  dividasAnteriores: number;
  servicos: number;
  percentualCaixa: number;
  percentualCompetencia: number;
  pacingTarget: number;
  acimaDaMeta: boolean;
  formatMoney: (value: number) => string;
};

/**
 * Caixa recebido != competência liquidada != aprovação da secretaria.
 * Este resumo é apenas apresentação dos agregados já calculados pelo domínio.
 */
export default function OperationsFinanceSummary({
  recebido, previsto, liquidadoCompetencia, mensalidades, dividasAnteriores,
  servicos, percentualCaixa, percentualCompetencia, pacingTarget, acimaDaMeta, formatMoney,
}: Props) {
  const progress = Math.min(100, Math.max(0, percentualCaixa));
  return (
    <section data-testid="operations-finance" className="operations-finance rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Resumo financeiro de caixa">
      <div className="operations-finance-head">
        <div className="min-w-0">
          <p className="operations-eyebrow">Recebido no mês (caixa)</p>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <strong className="operations-cash-value text-slate-900">{formatMoney(recebido)}</strong>
            <span className="text-sm text-slate-600">{previsto > 0 ? `de ${formatMoney(previsto)} previstos` : "sem previsão definida"}</span>
          </div>
        </div>
        <div className="operations-progress-result">
          <strong className="text-2xl font-black tabular-nums text-[#2B6044]">{percentualCaixa}%</strong>
          <span className="text-xs font-semibold text-slate-600">da meta de caixa</span>
        </div>
      </div>

      <div className="operations-finance-breakdown" aria-label="Decomposição de caixa e cobrança">
        <span>Mensalidades recebidas: <strong>{formatMoney(mensalidades)}</strong></span>
        <span>Dívidas antigas recebidas: <strong>{formatMoney(dividasAnteriores)}</strong></span>
        <span>Serviços recebidos: <strong>{formatMoney(servicos)}</strong></span>
        <span>Competência liquidada: <strong>{formatMoney(liquidadoCompetencia)}</strong> <span className="text-slate-500">({percentualCompetencia}%)</span></span>
      </div>

      {acimaDaMeta && (
        <p className="operations-finance-note flex items-start gap-2 text-xs text-slate-600">
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          Recebimentos podem incluir propinas de meses anteriores ou adiantamentos.
        </p>
      )}

      <div className="operations-progress" role="progressbar" aria-label="Caixa recebido em relação à meta" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={`${percentualCaixa}% da meta de caixa; o valor pode ultrapassar 100%`}>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-[#2B6044]" style={{ width: `${progress}%` }} />
        </div>
        {previsto > 0 && <span className="operations-target-marker" aria-hidden="true" style={{ left: `${Math.min(100, Math.max(0, pacingTarget))}%` }} />}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Meta mensal de caixa · marcador de referência de hoje
      </p>
    </section>
  );
}
