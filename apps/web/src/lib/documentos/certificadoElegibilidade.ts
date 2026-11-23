import "server-only";

/**
 * Validação académica antes de qualquer pagamento/emissão/impressão de
 * certificado. Usa exclusivamente o histórico oficial do aluno, escola e ano
 * pedidos; nunca recorre à matrícula ou notas do ano seguinte.
 *
 * Importante: uma nota de 0 é válida. A inexistência de linhas, notas nulas,
 * disciplinas sem nome e notas fora de 0–20 não podem produzir um certificado.
 */
export type CertificadoElegibilidade =
  | { ok: true; historicoId: string; totalDisciplinas: number }
  | {
      ok: false;
      code: "HISTORICO_INEXISTENTE" | "HISTORICO_ABERTO" |
        "NOTAS_INEXISTENTES" | "NOTAS_INCOMPLETAS" | "CONSULTA_INDISPONIVEL";
      error: string;
    };

export async function verificarCertificadoElegivel(params: {
  supabase: unknown;
  escolaId: string;
  alunoId: string;
  anoLetivo: number;
}): Promise<CertificadoElegibilidade> {
  const { escolaId, alunoId, anoLetivo } = params;
  if (!Number.isInteger(anoLetivo) || anoLetivo < 1900 || anoLetivo > 3000) {
    return { ok: false, code: "HISTORICO_INEXISTENTE", error: "Selecione um ano letivo válido." };
  }

  // Cliente tipado ou sem tipos gerados: ambas as tabelas têm políticas RLS.
  const supabase = params.supabase as any;
  const { data: historico, error: historicoError } = await supabase.from("historico_anos")
    .select("id, snapshot_status")
    .eq("escola_id", escolaId)
    .eq("aluno_id", alunoId)
    .eq("ano_letivo", anoLetivo)
    .maybeSingle();

  if (historicoError) {
    return { ok: false, code: "CONSULTA_INDISPONIVEL", error: "Não foi possível validar o histórico. Tente atualizar o estado." };
  }
  if (!historico?.id) {
    return { ok: false, code: "HISTORICO_INEXISTENTE", error: "O aluno não possui histórico para este ano. Regularize-o na Reconciliação Histórica antes de emitir." };
  }
  if (historico.snapshot_status !== "fechado") {
    return { ok: false, code: "HISTORICO_ABERTO", error: "O histórico deste ano ainda está aberto. Conclua a reconciliação académica antes de emitir." };
  }

  const { data: disciplinas, error: notasError } = await supabase.from("historico_disciplinas")
    .select("disciplina_nome, nota_final, media_final")
    .eq("historico_ano_id", historico.id)
    .limit(1000);
  if (notasError || !Array.isArray(disciplinas) || disciplinas.length >= 1000) {
    return { ok: false, code: "CONSULTA_INDISPONIVEL", error: "Não foi possível validar todas as disciplinas do histórico." };
  }
  if (disciplinas.length === 0) {
    return { ok: false, code: "NOTAS_INEXISTENTES", error: "O histórico está fechado, mas não tem notas. Regularize as classificações antes de emitir." };
  }

  const invalidas = disciplinas.filter((item: {
    disciplina_nome?: string | null;
    nota_final?: number | string | null;
    media_final?: number | string | null;
  }) => {
    const raw = item.nota_final ?? item.media_final;
    const nota = raw == null || raw === "" ? NaN : Number(raw);
    return !item.disciplina_nome?.trim() || !Number.isFinite(nota) || nota < 0 || nota > 20;
  });
  if (invalidas.length > 0) {
    return {
      ok: false, code: "NOTAS_INCOMPLETAS",
      error: `Existem ${invalidas.length} disciplina(s) sem classificação válida no histórico. Regularize antes de emitir.`,
    };
  }

  return { ok: true, historicoId: historico.id, totalDisciplinas: disciplinas.length };
}
