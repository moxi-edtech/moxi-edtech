import { instantiateAssistantActionV2, type AssistantActionV2 } from "../../actions-v2";
import type { AiWidgetContext } from "../../screen-context";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createDataCopilotResponse } from "../answer-composer";
import { matchesIntentTerms, normalizeAssistantText } from "../query-matcher";
import type { DataCopilotTool } from "../types";

type PedagogicalRiskRow = {
  turma_id: string | null;
  risk_score: number | null;
  risk_level: string | null;
  risk_reasons: string[] | null;
};

const RISK_REASON_LABELS: Record<string, string> = {
  three_consecutive_absences: "3 ou mais faltas consecutivas",
  attendance_below_75: "Frequência abaixo de 75%",
  grade_drop_15_points: "Queda de notas de pelo menos 15 pontos percentuais",
  current_grade_below_50: "Média actual abaixo de 50%",
};

export function isPedagogicalRiskQuery(query: string, context?: AiWidgetContext) {
  const normalizedQuery = normalizeAssistantText(query);
  const asksForRisk = matchesIntentTerms(normalizedQuery, ["risco"], {
    maxDistance: 2,
    minimumFuzzyLength: 4,
  });
  const hasPedagogicalQualifier = matchesIntentTerms(
    normalizedQuery,
    ["pedagogico", "reprovacao", "desempenho", "intervencao"],
    { maxDistance: 2 },
  );
  const hasDiagnosis = matchesIntentTerms(
    normalizedQuery,
    ["aluno", "turma", "prioridade", "atencao", "resumo", "quant", "quem", "sinal"],
    { maxDistance: 2 },
  );
  const hasAcademicContext = context?.module === "academico";

  return hasDiagnosis && (
    (asksForRisk && hasPedagogicalQualifier) ||
    (hasAcademicContext && (asksForRisk || hasPedagogicalQualifier))
  );
}

function formatReason(reason: string) {
  return RISK_REASON_LABELS[reason] ?? reason;
}

export const academicPedagogicalRiskTool: DataCopilotTool = {
  id: "academic-pedagogical-risk",
  module: "academico",
  requiredPermission: "assistant.academico",
  match: isPedagogicalRiskQuery,
  async run({ schoolId, role }) {
    const supabase = await supabaseServerTyped();
    const [actionableResult, insufficientResult] = await Promise.all([
      supabase
        .from("vw_risco_pedagogico_aluno")
        .select("turma_id, risk_score, risk_level, risk_reasons", { count: "exact" })
        .eq("escola_id", schoolId)
        .neq("data_coverage", "insufficient")
        .gt("risk_score", 0)
        .order("risk_score", { ascending: false })
        .limit(50),
      supabase
        .from("vw_risco_pedagogico_aluno")
        .select("matricula_id", { count: "exact", head: true })
        .eq("escola_id", schoolId)
        .eq("data_coverage", "insufficient"),
    ]);

    if (actionableResult.error) throw actionableResult.error;
    if (insufficientResult.error) throw insufficientResult.error;

    const rows = (actionableResult.data ?? []) as PedagogicalRiskRow[];
    const actionableStudents = actionableResult.count ?? rows.length;
    const insufficientStudents = insufficientResult.count ?? 0;
    const highRiskStudents = rows.filter((row) => row.risk_level === "high").length;
    const mediumRiskStudents = rows.filter((row) => row.risk_level === "medium").length;
    const affectedClasses = new Set(rows.map((row) => row.turma_id).filter(Boolean)).size;
    const maximumScore = rows.length > 0 ? Number(rows[0].risk_score ?? 0) : null;
    const frequentReasons = [...new Set(rows.flatMap((row) => row.risk_reasons ?? []))]
      .slice(0, 3)
      .map(formatReason);
    const interventionPlan = [
      "PLANO DE INTERVENÇÃO PEDAGÓGICA — RASCUNHO",
      "",
      `Escopo: ${actionableStudents} matrículas com sinais accionáveis em ${affectedClasses} turmas.`,
      `Prioridade: começar pelos casos de maior pontuação (máximo actual: ${maximumScore ?? 0}).`,
      `Sinais observados: ${frequentReasons.length > 0 ? frequentReasons.join("; ") : "a confirmar pela equipa pedagógica"}.`,
      "",
      "1. Coordenação pedagógica — confirmar notas, frequência, justificações e contexto de cada caso na fonte oficial.",
      "2. Professor responsável — propor apoio específico por disciplina e registar o acompanhamento.",
      "3. Secretaria — validar contactos e preparar eventual comunicação ao encarregado, sem envio automático.",
      "4. Coordenação pedagógica — definir responsável e prazo individual para cada intervenção aprovada.",
      "5. Equipa pedagógica — reavaliar frequência e desempenho entre 7 e 14 dias após o início.",
      "",
      "Gate humano: este plano é apenas um rascunho. Contactos, comunicações e intervenções exigem revisão e aprovação.",
      insufficientStudents > 0
        ? `Cobertura: ${insufficientStudents} matrículas permanecem com dados insuficientes e não devem ser classificadas como fora de risco.`
        : "Cobertura: não há matrículas marcadas como insuficientes neste recorte.",
    ].join("\n");
    const actions = [
      actionableStudents > 0
        ? instantiateAssistantActionV2(
            "academico:prepare_intervention_plan",
            role,
            { schoolId },
            { payload: { quickAction: "flow:pedagogical_intervention_plan", content: interventionPlan } },
          )
        : null,
      instantiateAssistantActionV2("academico:open_attendance", role, { schoolId }),
      instantiateAssistantActionV2("academico:open_grades", role, { schoolId }),
    ].filter((action): action is AssistantActionV2 => Boolean(action));
    const noActionableSignal = actionableStudents === 0;
    const coverageWarning = insufficientStudents > 0
      ? ` **${insufficientStudents} matrículas têm dados insuficientes** para uma avaliação segura.`
      : "";

    return createDataCopilotResponse({
      insight: {
        diagnosis: noActionableSignal
          ? `Não há sinais pedagógicos accionáveis com cobertura suficiente neste momento.${coverageWarning}`
          : `Foram identificadas **${actionableStudents} matrículas com sinais pedagógicos accionáveis**.${coverageWarning}`,
        impact: noActionableSignal
          ? insufficientStudents > 0
            ? "A ausência de sinais accionáveis não significa ausência de risco: faltam registos suficientes em parte da escola."
            : "Os dados actualmente disponíveis não apresentam alertas que atinjam os limiares definidos."
          : "Os sinais combinam frequência e desempenho para priorizar intervenção antes que o risco se agrave.",
        recommendation: noActionableSignal
          ? insufficientStudents > 0
            ? "Completar os registos de frequência e notas antes de concluir que os alunos estão fora de risco."
            : "Manter o acompanhamento regular e rever o radar após novos lançamentos."
          : "Rever primeiro os casos com maior pontuação, confirmar o contexto com a equipa pedagógica e definir uma intervenção humana.",
        evidence: [
          { label: "Sinais accionáveis", value: String(actionableStudents) },
          { label: "Risco alto na amostra", value: String(highRiskStudents) },
          { label: "Risco médio na amostra", value: String(mediumRiskStudents) },
          { label: "Turmas na amostra", value: String(affectedClasses) },
          { label: "Dados insuficientes", value: String(insufficientStudents) },
          { label: "Maior pontuação", value: maximumScore === null ? "Sem sinal accionável" : String(maximumScore) },
          {
            label: "Sinais observados",
            value: frequentReasons.length > 0 ? frequentReasons.join("; ") : "Nenhum na cobertura disponível",
          },
        ],
        actions,
      },
    });
  },
};
