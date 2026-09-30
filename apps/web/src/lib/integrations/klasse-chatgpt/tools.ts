import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import type { KlasseToolName } from "./schemas";

export const rpcByTool = {
  buscar_aluno: "klasse_search_students",
  listar_inadimplencia: "klasse_list_overdue_students",
  resumo_financeiro: "klasse_financial_summary",
  professores_com_notas: "klasse_teachers_with_grades",
  frequencia_turma: "klasse_class_attendance",
  situacao_academica_aluno: "klasse_student_academic_status",

  lancar_frequencia: "klasse_record_attendance",
  lancar_notas: "klasse_record_grades",
  preparar_pagamento: "klasse_prepare_payment",
  confirmar_pagamento: "klasse_confirm_payment",
  confirmacoes_pendentes: "klasse_pending_confirmations",
} as const;

const argsByTool = (tool: KlasseToolName, input: Record<string, unknown>) => {
  switch (tool) {
    case "buscar_aluno": return { p_query: input.query, p_limit: input.limit };
    case "listar_inadimplencia": return { p_limit: input.limit };
    case "resumo_financeiro":
    case "professores_com_notas": return { p_start_date: input.start_date, p_end_date: input.end_date };
    case "frequencia_turma": return { p_class_id: input.class_id, p_start_date: input.start_date, p_end_date: input.end_date };
    case "situacao_academica_aluno": return { p_student_id: input.student_id };

    case "lancar_frequencia":
      return {
        p_turma_id: input.turma_id,
        p_disciplina_id: input.disciplina_id,
        p_data: input.data,
        p_presencas: input.presencas,
      };
    case "lancar_notas":
      return {
        p_turma_id: input.turma_id,
        p_disciplina_id: input.disciplina_id,
        p_turma_disciplina_id: input.turma_disciplina_id,
        p_trimestre: input.trimestre,
        p_tipo_avaliacao: input.tipo_avaliacao,
        p_notas: input.notas,
        p_is_isento: input.is_isento,
      };
    case "preparar_pagamento":
      return {
        p_aluno_id: input.aluno_id,
        p_mensalidade_id: input.mensalidade_id,
        p_valor: input.valor ?? null,
        p_metodo: input.metodo,
      };
    case "confirmar_pagamento": return { p_token: input.token };
    case "confirmacoes_pendentes": return {};
  }
};

export async function runKlasseTool(supabase: SupabaseClient<Database>, tool: KlasseToolName, input: Record<string, unknown>) {
  // Os tipos gerados ainda não conhecem as RPCs desta migration. Mantemos o
  // cliente tipado e estreitamos apenas a assinatura dinâmica da chamada.
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;
  const { data, error } = await rpc(rpcByTool[tool], argsByTool(tool, input));
  if (error) throw error;
  return data;
}
