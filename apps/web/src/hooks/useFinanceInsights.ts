import { useMemo } from "react";

export type FinanceInsight = {
  id: string;
  tone: "rose" | "emerald" | "amber" | "sky";
  kicker: string;
  title: string;
  message: string;
  actionLabel: string;
  targetId: string;
  monthKey?: string;
};

export type FinanceDespesaInput = {
  label: string;
  total: number;
  qtd: number;
};

export type FinanceMensalInput = {
  ano: number;
  mes: number;
  labelMes: string;
  competenciaMes: string;
  totalPrevisto: number;
  totalPago: number;
};

export type FinancePorTurmaInput = {
  turmaNome: string;
  qtdMensalidades: number;
  qtdEmAtraso: number;
  qtdParciais: number;
  totalPago: number;
  totalPagoAdiantado: number;
};

export type FinanceInadimplenciaClasseInput = {
  mesRef: string;
  classeId: string;
  classeLabel: string;
  totalEmAtraso: number;
};

const kwanza = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
  maximumFractionDigits: 0,
});

function normalizeMonthKey(value: string) {
  return value.slice(0, 7);
}

type UseFinanceInsightsParams = {
  despesas: FinanceDespesaInput[];
  inadimplenciaClasseOrdenada: FinanceInadimplenciaClasseInput[];
  rankingTurmasOrdenado: FinancePorTurmaInput[];
  selectedMonth: string;
  serieMensalOrdenada: FinanceMensalInput[];
};

export function useFinanceInsights({
  despesas,
  inadimplenciaClasseOrdenada,
  rankingTurmasOrdenado,
  selectedMonth,
  serieMensalOrdenada,
}: UseFinanceInsightsParams) {
  return useMemo<FinanceInsight[]>(() => {
    const items: FinanceInsight[] = [];

    const availableMonthKeys = [...new Set(inadimplenciaClasseOrdenada.map((item) => normalizeMonthKey(item.mesRef)))].sort();
    const currentMonthKey =
      selectedMonth !== "all" ? selectedMonth : availableMonthKeys[availableMonthKeys.length - 1] ?? null;

    if (currentMonthKey) {
      const currentMonthIndex = availableMonthKeys.indexOf(currentMonthKey);
      const previousMonthKey = currentMonthIndex > 0 ? availableMonthKeys[currentMonthIndex - 1] : null;

      if (previousMonthKey) {
        const previousByClass = inadimplenciaClasseOrdenada
          .filter((item) => normalizeMonthKey(item.mesRef) === previousMonthKey)
          .reduce<Record<string, number>>((acc, item) => {
            acc[item.classeId] = (acc[item.classeId] || 0) + item.totalEmAtraso;
            return acc;
          }, {});

        const trendCandidate = inadimplenciaClasseOrdenada
          .filter((item) => normalizeMonthKey(item.mesRef) === currentMonthKey)
          .map((item) => {
            const previousTotal = previousByClass[item.classeId] || 0;
            const deltaPct =
              previousTotal > 0 ? ((item.totalEmAtraso - previousTotal) / previousTotal) * 100 : item.totalEmAtraso > 0 ? 100 : 0;

            return {
              classeLabel: item.classeLabel,
              totalAtual: item.totalEmAtraso,
              deltaPct,
            };
          })
          .filter((item) => item.deltaPct >= 10 && item.totalAtual > 0)
          .sort((a, b) => {
            if (b.deltaPct !== a.deltaPct) return b.deltaPct - a.deltaPct;
            return b.totalAtual - a.totalAtual;
          })[0];

        if (trendCandidate) {
          items.push({
            id: "trend-alert",
            tone: "rose",
            kicker: "Alerta de tendência",
            title: `${trendCandidate.classeLabel} subiu ${trendCandidate.deltaPct.toFixed(0)}%`,
            message: `A inadimplência desta classe acelerou face a ${previousMonthKey}. Vale abrir a fila de cobrança antes do próximo fecho.`,
            actionLabel: "Ver detalhes",
            targetId: "inadimplencia-por-classe",
            monthKey: currentMonthKey,
          });
        }
      }
    }

    const targetProjectionRow =
      selectedMonth === "all"
        ? serieMensalOrdenada[serieMensalOrdenada.length - 1]
        : serieMensalOrdenada.find(
            (row) => `${row.ano}-${String(row.mes).padStart(2, "0")}` === selectedMonth
          );

    if (targetProjectionRow && targetProjectionRow.totalPrevisto > 0) {
      const historicalRates = serieMensalOrdenada
        .filter((row) => row.competenciaMes !== targetProjectionRow.competenciaMes && row.totalPrevisto > 0)
        .slice(-3)
        .map((row) => row.totalPago / row.totalPrevisto)
        .filter((rate) => Number.isFinite(rate) && rate > 0);

      const avgRate =
        historicalRates.length > 0
          ? historicalRates.reduce((sum, rate) => sum + rate, 0) / historicalRates.length
          : targetProjectionRow.totalPrevisto > 0
            ? targetProjectionRow.totalPago / targetProjectionRow.totalPrevisto
            : 0;
      const projectedPaid = Math.min(targetProjectionRow.totalPrevisto, targetProjectionRow.totalPrevisto * Math.max(avgRate, 0));
      const projectedExtra = Math.max(projectedPaid - targetProjectionRow.totalPago, 0);

      if (projectedExtra > 0) {
        items.push({
          id: "projection",
          tone: "sky",
          kicker: "Projeção de arrecadação",
          title: `Há potencial para recuperar mais ${kwanza.format(projectedExtra)}`,
          message: `Se o ritmo histórico se mantiver em ${targetProjectionRow.labelMes}, a escola ainda pode converter esse valor até o fecho da competência.`,
          actionLabel: "Abrir fluxo mensal",
          targetId: "fluxo-mensal",
          monthKey: `${targetProjectionRow.ano}-${String(targetProjectionRow.mes).padStart(2, "0")}`,
        });
      }
    }

    const bestTurma = rankingTurmasOrdenado
      .map((item) => {
        const punctualityPct =
          item.qtdMensalidades > 0
            ? ((item.qtdMensalidades - item.qtdEmAtraso - item.qtdParciais) / item.qtdMensalidades) * 100
            : 0;

        return { ...item, punctualityPct };
      })
      .filter((item) => item.qtdMensalidades > 0)
      .sort((a, b) => {
        if (b.punctualityPct !== a.punctualityPct) return b.punctualityPct - a.punctualityPct;
        return (b.totalPago + b.totalPagoAdiantado) - (a.totalPago + a.totalPagoAdiantado);
      })[0];

    if (bestTurma && bestTurma.punctualityPct > 0) {
      items.push({
        id: "benchmark",
        tone: "emerald",
        kicker: "Destaque positivo",
        title: `${bestTurma.turmaNome} lidera com ${bestTurma.punctualityPct.toFixed(0)}%`,
        message: "Esta turma foi a mais pontual do período e pode servir de benchmark operacional para cobrança e confirmação.",
        actionLabel: "Ver ranking",
        targetId: "ranking-por-turma",
      });
    }

    const uncategorizedExpense = despesas
      .filter((item) => {
        const normalized = item.label.trim().toLowerCase();
        return normalized === "outras despesas" || normalized === "sem categoria" || normalized === "sem categoria definida";
      })
      .reduce(
        (acc, item) => ({
          qtd: acc.qtd + item.qtd,
          total: acc.total + item.total,
        }),
        { qtd: 0, total: 0 }
      );

    if (uncategorizedExpense.qtd > 0) {
      items.push({
        id: "ledger-anomaly",
        tone: "amber",
        kicker: "Anomalia de ledger",
        title: `${uncategorizedExpense.qtd} saídas sem categoria definida`,
        message: `Esses lançamentos já impactam ${kwanza.format(uncategorizedExpense.total)} no saldo final e reduzem a leitura gerencial do período.`,
        actionLabel: "Rever despesas",
        targetId: "despesas-operacionais",
      });
    }

    return items.slice(0, 4);
  }, [despesas, inadimplenciaClasseOrdenada, rankingTurmasOrdenado, selectedMonth, serieMensalOrdenada]);
}
