import {
  AlertCircle,
  ArrowDownRight,
  CheckCircle2,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo } from "react";

const kwanza = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
  maximumFractionDigits: 0,
});

export type FinancialHealthInsight = {
  type: "success" | "warning" | "info" | "goal";
  text: string;
  icon: LucideIcon;
};

type ExecutiveHighlightInput = {
  classeLabel: string;
  totalEmAtraso: number;
};

type ResumoInput = {
  pago: number;
  previsto: number;
  atraso: number;
  taxaAtrasoPct: number;
};

type UseFinancialHealthInsightsParams = {
  executiveHighlights: ExecutiveHighlightInput[];
  resumo: ResumoInput;
  totalEntradasResultado: number;
  totalSaidasResultado: number;
};

export function useFinancialHealthInsights({
  executiveHighlights,
  resumo,
  totalEntradasResultado,
  totalSaidasResultado,
}: UseFinancialHealthInsightsParams) {
  const healthScore = useMemo(() => {
    if (resumo.previsto === 0) return 0;

    const arrecadacaoScore = Math.min(100, (resumo.pago / resumo.previsto) * 100);
    const inadimplenciaScore = Math.max(0, 100 - resumo.taxaAtrasoPct * 5);

    return Math.round(arrecadacaoScore * 0.6 + inadimplenciaScore * 0.4);
  }, [resumo]);

  const financialInsights = useMemo<FinancialHealthInsight[]>(() => {
    const list: FinancialHealthInsight[] = [];

    if (healthScore >= 80) {
      list.push({
        type: "success",
        text: "Saúde financeira excelente! A arrecadação está sólida e a inadimplência sob controle.",
        icon: Trophy,
      });
    } else if (healthScore <= 40) {
      list.push({
        type: "warning",
        text: "Atenção: A saúde financeira requer intervenção imediata nas cobranças.",
        icon: AlertCircle,
      });
    }

    const balance = totalEntradasResultado - totalSaidasResultado;
    if (balance > 0) {
      list.push({
        type: "success",
        text: `Operação superavitária em ${kwanza.format(balance)} neste recorte.`,
        icon: TrendingUp,
      });
    } else if (balance < 0) {
      list.push({
        type: "warning",
        text: `Operação com déficit de ${kwanza.format(Math.abs(balance))}. Saídas superam entradas.`,
        icon: ArrowDownRight,
      });
    }

    if (executiveHighlights.length > 0 && executiveHighlights[0].totalEmAtraso > 0) {
      const top = executiveHighlights[0];
      const pct = (top.totalEmAtraso / (resumo.atraso || 1)) * 100;
      if (pct > 20) {
        list.push({
          type: "info",
          text: `A classe ${top.classeLabel} concentra ${Math.round(pct)}% de toda a inadimplência pendente.`,
          icon: Target,
        });
      }
    }

    const arrecadacaoPct = (resumo.pago / (resumo.previsto || 1)) * 100;
    if (arrecadacaoPct < 70) {
      list.push({
        type: "goal",
        text: `Meta de arrecadação: Faltam ${Math.round(70 - arrecadacaoPct)}% para atingir o patamar de segurança (70%).`,
        icon: Zap,
      });
    } else {
      list.push({
        type: "success",
        text: "Meta de segurança de 70% de arrecadação atingida com sucesso!",
        icon: CheckCircle2,
      });
    }

    return list;
  }, [executiveHighlights, healthScore, resumo, totalEntradasResultado, totalSaidasResultado]);

  return {
    healthScore,
    financialInsights,
  };
}
