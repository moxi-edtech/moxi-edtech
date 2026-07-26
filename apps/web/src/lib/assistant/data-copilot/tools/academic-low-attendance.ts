import { instantiateAssistantActionV2, type AssistantActionV2 } from "../../actions-v2";
import type { AiWidgetContext } from "../../screen-context";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createDataCopilotResponse } from "../answer-composer";
import { matchesIntentQuery } from "../query-matcher";
import type { DataCopilotTool } from "../types";

type AttendanceRiskRow = {
  turma_id: string | null;
  percentual_presenca: number | string | null;
};

const MINIMUM_ATTENDANCE = 75;

export function isLowAttendanceQuery(query: string, context?: AiWidgetContext) {
  return matchesIntentQuery({
    query,
    scopeTerms: ["frequencia", "presenca", "falta"],
    diagnosisTerms: ["baix", "risco", "aluno", "turma", "pendent", "atencao", "resumo"],
    contextMatches: context?.module === "academico",
    options: { maxDistance: 2 },
  });
}

export const academicLowAttendanceTool: DataCopilotTool = {
  id: "academic-low-attendance",
  module: "academico",
  requiredPermission: "assistant.academico",
  match: isLowAttendanceQuery,
  async run({ schoolId, role }) {
    const supabase = await supabaseServerTyped();
    const [riskResult, coverageResult, enrollmentResult] = await Promise.all([
      supabase
        .from("vw_frequencia_resumo_aluno")
        .select("turma_id, percentual_presenca", { count: "exact" })
        .eq("escola_id", schoolId)
        .lt("percentual_presenca", MINIMUM_ATTENDANCE)
        .order("percentual_presenca", { ascending: true })
        .limit(50),
      supabase
        .from("vw_frequencia_resumo_aluno")
        .select("aluno_id", { count: "exact", head: true })
        .eq("escola_id", schoolId),
      supabase
        .from("matriculas")
        .select("id", { count: "exact", head: true })
        .eq("escola_id", schoolId)
        .eq("ativo", true)
        .in("status", ["ativo", "ativa", "active"]),
    ]);

    if (riskResult.error) throw riskResult.error;
    if (coverageResult.error) throw coverageResult.error;
    if (enrollmentResult.error) throw enrollmentResult.error;

    const rows = (riskResult.data ?? []) as AttendanceRiskRow[];
    const affectedStudents = riskResult.count ?? rows.length;
    const coveredStudents = coverageResult.count ?? 0;
    const activeEnrollments = enrollmentResult.count ?? 0;
    const uncoveredStudents = Math.max(activeEnrollments - coveredStudents, 0);
    const hasInsufficientCoverage = activeEnrollments > 0 && coveredStudents === 0;
    const hasPartialCoverage = coveredStudents > 0 && uncoveredStudents > 0;
    const affectedClasses = new Set(rows.map((row) => row.turma_id).filter(Boolean)).size;
    const lowestRate = rows.length > 0 ? Number(rows[0].percentual_presenca ?? 0) : null;
    const action = instantiateAssistantActionV2("academico:open_attendance", role, { schoolId });
    const actions: AssistantActionV2[] = action ? [action] : [];

    return createDataCopilotResponse({
      insight: {
        diagnosis: hasInsufficientCoverage
          ? `Não há dados suficientes para avaliar frequência: **0 de ${activeEnrollments} matrículas activas** possuem registos.`
          : affectedStudents === 0
            ? hasPartialCoverage
              ? `Não foram encontrados alunos abaixo de 75% entre os **${coveredStudents} alunos com registos**, mas **${uncoveredStudents} matrículas** ainda não têm cobertura.`
              : "Não há alunos abaixo do limite de 75% nos registos disponíveis."
          : `Foram identificados **${affectedStudents} alunos abaixo de 75% de frequência**.`,
        impact: hasInsufficientCoverage
          ? "A ausência de registos impede concluir se há ou não risco de frequência."
          : hasPartialCoverage
            ? "O resultado é parcial e não representa as matrículas sem registos de presença."
            : affectedStudents === 0
              ? "Não há alerta de frequência na cobertura actualmente disponível."
          : "Estes alunos podem entrar em risco acadêmico e exigem acompanhamento da equipe pedagógica.",
        recommendation: hasInsufficientCoverage || hasPartialCoverage
          ? "Completar os registos de frequência antes de concluir que os alunos estão fora de risco."
          : affectedStudents === 0
            ? "Manter o acompanhamento regular de presenças."
          : "Rever os casos com menor frequência, confirmar justificativas e preparar acompanhamento com as turmas afetadas.",
        evidence: [
          { label: "Alunos abaixo de 75%", value: String(affectedStudents) },
          { label: "Turmas na amostra", value: String(affectedClasses) },
          { label: "Matrículas activas", value: String(activeEnrollments) },
          { label: "Alunos com frequência registada", value: String(coveredStudents) },
          { label: "Sem cobertura", value: String(uncoveredStudents) },
          { label: "Menor frequência", value: lowestRate === null ? "Sem dados calculáveis" : `${lowestRate.toFixed(1)}%` },
        ],
        actions,
      },
    });
  },
};
