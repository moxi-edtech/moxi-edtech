import { instantiateAssistantActionV2, type AssistantActionV2 } from "../../actions-v2";
import type { AiWidgetContext } from "../../screen-context";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createDataCopilotResponse } from "../answer-composer";
import { matchesIntentQuery } from "../query-matcher";
import type { DataCopilotTool } from "../types";

type AdmissionsCountsRow = {
  submetida_total: number | null;
  em_analise_total: number | null;
  aprovada_total: number | null;
  matriculado_7d_total: number | null;
  expirando_24h_total: number | null;
  reenviados_48h_total: number | null;
};

export function isAdmissionsPendingQuery(query: string, context?: AiWidgetContext) {
  return matchesIntentQuery({
    query,
    scopeTerms: ["admiss", "candidat"],
    diagnosisTerms: ["pendent", "aguard", "analis", "quant", "estado", "resumo", "atencao"],
    contextMatches: context?.page === "admissoes",
    options: { maxDistance: 2 },
  });
}

export const admissionsPendingTool: DataCopilotTool = {
  id: "admissions-pending",
  module: "secretaria",
  requiredPermission: "assistant.secretaria",
  match: isAdmissionsPendingQuery,
  async run({ schoolId, role }) {
    const supabase = await supabaseServerTyped();
    const { data, error } = await supabase
      .from("vw_admissoes_counts_por_status")
      .select("submetida_total, em_analise_total, aprovada_total, matriculado_7d_total, expirando_24h_total, reenviados_48h_total")
      .eq("escola_id", schoolId)
      .maybeSingle();

    if (error) throw error;

    const counts = data as AdmissionsCountsRow | null;
    const submitted = Number(counts?.submetida_total ?? 0);
    const underReview = Number(counts?.em_analise_total ?? 0);
    const expiring = Number(counts?.expirando_24h_total ?? 0);
    const pending = submitted + underReview;
    const action = instantiateAssistantActionV2("secretaria:open_admissions", role, { schoolId });
    const actions: AssistantActionV2[] = action ? [action] : [];

    return createDataCopilotResponse({
      insight: {
        diagnosis: pending === 0
          ? "Não há candidaturas submetidas ou em análise neste momento."
          : `Existem **${pending} candidaturas pendentes**: **${submitted} submetidas** e **${underReview} em análise**.`,
        impact: expiring > 0
          ? `**${expiring} candidaturas expiram nas próximas 24 horas** e devem ser priorizadas.`
          : pending > 0
            ? "As candidaturas aguardam triagem ou decisão da Secretaria."
            : "O fluxo de admissões não apresenta fila operacional pendente.",
        recommendation: expiring > 0
          ? "Rever primeiro as candidaturas próximas da expiração e depois ordenar a fila por antiguidade."
          : pending > 0
            ? "Abrir a central de admissões e tratar primeiro as candidaturas submetidas há mais tempo."
            : "Manter a monitorização da campanha de admissões.",
        evidence: [
          { label: "Submetidas", value: String(submitted) },
          { label: "Em análise", value: String(underReview) },
          { label: "Expiram em 24h", value: String(expiring) },
          { label: "Matriculadas em 7 dias", value: String(Number(counts?.matriculado_7d_total ?? 0)) },
        ],
        actions,
      },
    });
  },
};
