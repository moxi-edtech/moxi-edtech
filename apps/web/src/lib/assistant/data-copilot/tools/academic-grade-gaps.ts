import { instantiateAssistantActionV2, type AssistantActionV2 } from "../../actions-v2";
import type { AiWidgetContext } from "../../screen-context";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createDataCopilotResponse } from "../answer-composer";
import type { DataCopilotTool } from "../types";

type GradeGapRow = {
  turma_id: string | null;
  pendentes: number | string | null;
};

export function isGradeGapsQuery(query: string, context?: AiWidgetContext) {
  const hasAcademicScope = /nota|pauta|lan[cç]amento|avalia[cç][aã]o/.test(query) || context?.page === "notas";
  const asksForDiagnosis = /incomplet|pendent|falta|risco|turma|disciplina|aten[cç][aã]o|resumo/.test(query);
  return Boolean(hasAcademicScope && asksForDiagnosis);
}

export const academicGradeGapsTool: DataCopilotTool = {
  id: "academic-grade-gaps",
  module: "academico",
  requiredPermission: "assistant.academico",
  match: isGradeGapsQuery,
  async run({ schoolId, role }) {
    const supabase = await supabaseServerTyped();
    const { data, count, error } = await supabase
      .from("vw_professor_pendencias")
      .select("turma_id, pendentes", { count: "exact" })
      .eq("escola_id", schoolId)
      .gt("pendentes", 0)
      .order("pendentes", { ascending: false })
      .limit(50);

    if (error) throw error;

    const rows = (data ?? []) as GradeGapRow[];
    const incompleteEntries = count ?? rows.length;
    const affectedClasses = new Set(rows.map((row) => row.turma_id).filter(Boolean)).size;
    const pendingInSample = rows.reduce((sum, row) => sum + Number(row.pendentes ?? 0), 0);
    const action = instantiateAssistantActionV2("academico:open_grades", role, { schoolId });
    const actions: AssistantActionV2[] = action ? [action] : [];

    return createDataCopilotResponse({
      insight: {
        diagnosis: incompleteEntries === 0
          ? "Não há lançamentos de notas incompletos."
          : `Existem **${incompleteEntries} avaliações ou disciplinas com notas pendentes**.`,
        impact: incompleteEntries === 0
          ? "O fechamento acadêmico não apresenta lacunas de notas nesta fonte."
          : "As pendências podem atrasar pautas, boletins e o fechamento acadêmico.",
        recommendation: incompleteEntries === 0
          ? "Manter o acompanhamento do calendário acadêmico."
          : "Priorizar as turmas com maior número de notas pendentes e acompanhar o lançamento com os responsáveis.",
        evidence: [
          { label: "Lançamentos incompletos", value: String(incompleteEntries) },
          { label: "Turmas na amostra", value: String(affectedClasses) },
          { label: "Notas pendentes na amostra", value: String(pendingInSample) },
        ],
        actions,
      },
    });
  },
};
