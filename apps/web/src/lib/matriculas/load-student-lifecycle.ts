import {
  construirCicloVidaAluno,
  type HistoricoLifecycleInput,
  type MatriculaLifecycleInput,
  type StudentLifecycle,
} from "@/lib/matriculas/student-lifecycle";

/**
 * A leitura é sempre limitada à escola E ao aluno previamente autorizados
 * pela rota. Falhar fechado: um histórico indisponível não é "aprovado".
 */
export async function carregarCicloVidaAluno(
  supabase: any,
  escolaId: string,
  alunoId: string,
): Promise<StudentLifecycle> {
  const [matriculasResult, historicosResult] = await Promise.all([
    supabase
      .from("matriculas")
      .select("id, escola_id, aluno_id, ano_letivo, status, ativo, turma_id, origem_transicao_matricula_id, data_fecho, motivo_fecho")
      .eq("escola_id", escolaId)
      .eq("aluno_id", alunoId)
      .order("ano_letivo", { ascending: false })
      .limit(500),
    supabase
      .from("historico_anos")
      .select("id, matricula_id, escola_id, aluno_id, ano_letivo, resultado_final, snapshot_status")
      .eq("escola_id", escolaId)
      .eq("aluno_id", alunoId)
      .order("ano_letivo", { ascending: false })
      .limit(500),
  ]);
  if (matriculasResult.error || historicosResult.error) {
    throw new Error("Não foi possível obter os estados oficiais de matrícula e histórico.");
  }
  const matriculas = (matriculasResult.data ?? []) as MatriculaLifecycleInput[];
  const historicos = (historicosResult.data ?? []) as HistoricoLifecycleInput[];
  if (matriculas.length === 500 || historicos.length === 500) {
    // Não publicar uma projeção parcial como verdade canónica.
    throw new Error("O histórico ultrapassa o limite de leitura; requer consulta paginada.");
  }
  return construirCicloVidaAluno(matriculas, historicos);
}
