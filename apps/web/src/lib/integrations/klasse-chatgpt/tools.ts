import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import type { KlasseToolName } from "./schemas";

const rpcByTool = {
  buscar_aluno: "klasse_search_students",
  listar_inadimplencia: "klasse_list_overdue_students",
  resumo_financeiro: "klasse_financial_summary",
  professores_com_notas: "klasse_teachers_with_grades",
  frequencia_turma: "klasse_class_attendance",
  situacao_academica_aluno: "klasse_student_academic_status",
} as const;

const argsByTool = (tool: KlasseToolName, input: Record<string, unknown>) => {
  switch (tool) {
    case "buscar_aluno": return { p_query: input.query, p_limit: input.limit };
    case "listar_inadimplencia": return { p_limit: input.limit };
    case "resumo_financeiro":
    case "professores_com_notas": return { p_start_date: input.start_date, p_end_date: input.end_date };
    case "frequencia_turma": return { p_class_id: input.class_id, p_start_date: input.start_date, p_end_date: input.end_date };
    case "situacao_academica_aluno": return { p_student_id: input.student_id };
  }
};

export async function runKlasseTool(supabase: SupabaseClient<Database>, tool: KlasseToolName, input: Record<string, unknown>) {
  const { data, error } = await (supabase as any).rpc(rpcByTool[tool], argsByTool(tool, input));
  if (error) throw error;
  return data;
}

