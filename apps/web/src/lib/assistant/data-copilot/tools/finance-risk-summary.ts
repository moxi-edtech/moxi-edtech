import { instantiateAssistantActionV2, type AssistantActionV2 } from "../../actions-v2";
import type { AiWidgetContext } from "../../screen-context";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createDataCopilotResponse } from "../answer-composer";
import { matchesIntentQuery } from "../query-matcher";
import type { DataCopilotTool } from "../types";

type RiskRow = {
  valor_em_atraso: number | string | null;
  dias_em_atraso: number | null;
};

const AOA_FORMATTER = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
});

export function isFinanceRiskSummaryQuery(query: string, context?: AiWidgetContext) {
  return matchesIntentQuery({
    query,
    scopeTerms: ["finance", "inadimpl", "divida", "devedor", "cobranca"],
    diagnosisTerms: ["risco", "resumo", "total", "atencao", "situacao", "quant"],
    contextMatches: context?.module === "financeiro",
    options: { maxDistance: 2 },
  });
}

export const financeRiskSummaryTool: DataCopilotTool = {
  id: "finance-risk-summary",
  module: "financeiro",
  requiredPermission: "assistant.finance",
  match: isFinanceRiskSummaryQuery,
  async run({ schoolId, role }) {
    const supabase = await supabaseServerTyped();
    const { data, count, error } = await supabase
      .from("vw_financeiro_inadimplencia_top")
      .select("valor_em_atraso, dias_em_atraso", { count: "exact" })
      .eq("escola_id", schoolId)
      .order("valor_em_atraso", { ascending: false })
      .limit(50);

    if (error) throw error;

    const rows = (data ?? []) as RiskRow[];
    const debtors = count ?? rows.length;
    const sampleDebt = rows.reduce((sum, row) => sum + Number(row.valor_em_atraso ?? 0), 0);
    const maxDays = rows.reduce((max, row) => Math.max(max, Number(row.dias_em_atraso ?? 0)), 0);
    const action = instantiateAssistantActionV2("finance:open_radar", role, { schoolId });
    const actions: AssistantActionV2[] = action ? [action] : [];

    return createDataCopilotResponse({
      insight: {
        diagnosis: debtors === 0
          ? "Não há devedores no resumo financeiro atual."
          : `O radar identifica **${debtors} alunos com valores em atraso**.`,
        impact: debtors === 0
          ? "Não há risco vencido identificado nesta fonte."
          : `Os 50 maiores casos somam **${AOA_FORMATTER.format(sampleDebt)}** e chegam a **${maxDays} dias de atraso**.`,
        recommendation: debtors === 0
          ? "Manter a monitorização do radar."
          : "Priorizar os maiores valores e atrasos mais antigos para cobrança segmentada.",
        evidence: [
          { label: "Alunos em atraso", value: String(debtors) },
          { label: "Valor nos 50 maiores casos", value: AOA_FORMATTER.format(sampleDebt) },
          { label: "Maior atraso", value: `${maxDays} dias` },
        ],
        actions,
      },
    });
  },
};
