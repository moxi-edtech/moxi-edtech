import {
  construirCicloVidaAluno,
  normalizarEstadoMatricula,
  type HistoricoLifecycleInput,
  type MatriculaLifecycleInput,
  type MatriculaOperacional,
  type StudentLifecycle,
} from "@/lib/matriculas/student-lifecycle";
import { isAcaoMatriculaContextual, isSituacaoMatriculaContextual, isSituacaoResultadoContextual, type SituacaoMatriculaContextual, type SituacaoResultadoContextual, type AcaoMatriculaContextual } from "@/lib/matriculas/lifecycle-status-contract";

type EstadoDb = {
  matricula_id: string;
  escola_id: string;
  aluno_id: string;
  ano_letivo: number | null;
  status_persistido: string | null;
  ativo_persistido: boolean | null;
  turma_id: string | null;
  origem_transicao_matricula_id: string | null;
  data_fecho: string | null;
  motivo_fecho: string | null;
  estado_operacional: MatriculaOperacional;
  resultado_oficial: string | null;
  situacao_contextual: SituacaoMatriculaContextual;
  situacao_resultado: SituacaoResultadoContextual;
  acao_contextual: AcaoMatriculaContextual;
};

/**
 * Leitura SSOT diretamente da VIEW Postgres security_invoker=true.
 * Escola e aluno já devem estar autorizados na rota. O RLS aplica-se às
 * tabelas de matrícula, histórico e bloqueio legal. Não fazer fallback que
 * transforme erro da view em resultado académico "aprovado".
 */
export async function carregarCicloVidaAluno(
  // O cliente fornecido pela rota pode ter esquemas tipados distintos; a view é validada abaixo.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  escolaId: string,
  alunoId: string,
): Promise<StudentLifecycle> {
  const [estadoResult, historicosResult] = await Promise.all([
    supabase
      .from("v_student_lifecycle_status_v2")
      .select("matricula_id, escola_id, aluno_id, ano_letivo, status_persistido, ativo_persistido, turma_id, origem_transicao_matricula_id, data_fecho, motivo_fecho, estado_operacional, resultado_oficial, situacao_contextual, situacao_resultado, acao_contextual")
      .eq("escola_id", escolaId)
      .eq("aluno_id", alunoId)
      .order("ano_letivo", { ascending: false })
      .limit(500),
    // Mantemos a leitura por aluno para detectar o histórico legado sem
    // matricula_id, que não entra na junção da view.
    supabase
      .from("historico_anos")
      .select("id, matricula_id, escola_id, aluno_id, ano_letivo, resultado_final, snapshot_status")
      .eq("escola_id", escolaId)
      .eq("aluno_id", alunoId)
      .order("ano_letivo", { ascending: false })
      .limit(500),
  ]);
  if (estadoResult.error || historicosResult.error) {
    throw new Error("Não foi possível obter o SSOT do ciclo de vida do aluno.");
  }
  const estados = (estadoResult.data ?? []) as EstadoDb[];
  const historicos = (historicosResult.data ?? []) as HistoricoLifecycleInput[];
  if (estados.length === 500 || historicos.length === 500) {
    throw new Error("O histórico ultrapassa o limite de leitura; requer consulta paginada.");
  }
  for (const row of estados) {
    if (row.escola_id !== escolaId || row.aluno_id !== alunoId
      || normalizarEstadoMatricula(row.status_persistido, row.ativo_persistido) !== row.estado_operacional) {
      // Divergência de contrato ou isolamento; nunca devolver estado ambíguo.
      throw new Error("A projeção do banco diverge do contrato canónico do aluno.");
    }
  }
  const matriculas: MatriculaLifecycleInput[] = estados.map((row) => ({
    id: row.matricula_id,
    escola_id: row.escola_id,
    aluno_id: row.aluno_id,
    ano_letivo: row.ano_letivo,
    status: row.status_persistido,
    ativo: row.ativo_persistido,
    turma_id: row.turma_id,
    origem_transicao_matricula_id: row.origem_transicao_matricula_id,
    data_fecho: row.data_fecho,
    motivo_fecho: row.motivo_fecho,
  }));
  const oficiais = new Map(estados.map((row) => [row.matricula_id, row.resultado_oficial]));
  const ciclo = construirCicloVidaAluno(matriculas, historicos, oficiais);
  const origem = new Map(estados.map((row) => [row.matricula_id, row]));
  const enriquecidas = ciclo.matriculas.map((row) => {
    const db = origem.get(row.matriculaId);
    if (!db || !isSituacaoMatriculaContextual(db.situacao_contextual)
      || !isSituacaoResultadoContextual(db.situacao_resultado)
      || !isAcaoMatriculaContextual(db.acao_contextual)) {
      throw new Error("O contrato contextual de matrícula não corresponde à projeção do banco.");
    }
    return {
      ...row, situacaoContextual: db.situacao_contextual,
      situacaoResultado: db.situacao_resultado, acaoContextual: db.acao_contextual,
      // Não voltar a oferecer "confirmar matrícula" para um ano antigo.
      proximaAcao: db.situacao_contextual === "regularizacao_historica"
        ? "rever_integridade" as const : row.proximaAcao,
    };
  });
  return { ...ciclo, matriculas: enriquecidas,
    matriculaCorrente: enriquecidas.find((r) => r.matriculaId === ciclo.matriculaCorrente?.matriculaId) ?? null };
}
