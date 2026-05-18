import "server-only";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export type DocumentoSnapshot = {
  aluno_id: string;
  aluno_nome?: string | null;
  aluno_bi?: string | null;
  matricula_id?: string | null;
  turma_id?: string | null;
  turma_nome?: string | null;
  turma_turno?: string | null;
  classe_nome?: string | null;
  curso_nome?: string | null;
  ano_letivo?: number | null;
  tipo_documento?: string | null;
  numero_sequencial?: number | null;
  hash_validacao?: string | null;
};

export type DocumentoEmitido = {
  id: string;
  public_id: string;
  escola_id: string;
  tipo: string;
  created_at: string;
  hash_validacao?: string | null;
  dados_snapshot: DocumentoSnapshot;
};

export async function getDocumentoEmitido(docId: string) {
  const supabase = await supabaseServerTyped();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return { error: "Não autenticado" } as const;
  }

  const { data: doc, error } = await supabase
    .from("documentos_emitidos")
    .select("id, public_id, escola_id, aluno_id, mensalidade_id, tipo, created_at, dados_snapshot, numero_sequencial, hash_validacao")
    .eq("id", docId)
    .single();

  if (error || !doc) {
    return { error: "Documento não encontrado" } as const;
  }

  const escolaId = await resolveEscolaIdForUser(supabase as any, user.id, doc.escola_id as string);
  if (!escolaId || escolaId !== doc.escola_id) {
    return { error: "Sem permissão" } as const;
  }

  const { data: escolaInfo } = await supabase
    .from("vw_escola_info" as any)
    .select("nome")
    .eq("escola_id", doc.escola_id)
    .maybeSingle();
  const { data: escola } = await supabase
    .from("escolas")
    .select("validation_base_url, logo_url")
    .eq("id", doc.escola_id)
    .maybeSingle();
  const escolaInfoRow = escolaInfo as { nome?: string | null } | null;
  const escolaRow = escola as { validation_base_url?: string | null; logo_url?: string | null } | null;
  const rawSnapshot = doc.dados_snapshot;
  const snapshot =
    rawSnapshot && typeof rawSnapshot === "object" && !Array.isArray(rawSnapshot)
      ? (rawSnapshot as DocumentoSnapshot)
      : ({} as DocumentoSnapshot);

  const enrichedSnapshot = { ...snapshot };

  if (doc.tipo === "recibo") {
    const needsAluno = !enrichedSnapshot.aluno_nome || !enrichedSnapshot.aluno_bi;
    const needsTurma = !enrichedSnapshot.turma_nome || !enrichedSnapshot.classe_nome || !enrichedSnapshot.curso_nome;

    if (needsAluno || needsTurma) {
      const snapshotRecord = snapshot as Record<string, unknown>;
      const mensalidadeId =
        typeof doc.mensalidade_id === "string"
          ? doc.mensalidade_id
          : typeof snapshotRecord.mensalidade_id === "string"
            ? snapshotRecord.mensalidade_id
            : null;
      let alunoId = typeof doc.aluno_id === "string" ? doc.aluno_id : null;
      let turmaId = typeof snapshot.turma_id === "string" ? snapshot.turma_id : null;
      let anoReferencia: number | null = null;

      if (mensalidadeId) {
        const { data: mensalidade } = await supabase
          .from("mensalidades" as any)
          .select("aluno_id, turma_id, ano_referencia")
          .eq("id", mensalidadeId)
          .maybeSingle();
        const mensalidadeRow = mensalidade as { aluno_id?: string | null; turma_id?: string | null; ano_referencia?: number | null } | null;
        alunoId = alunoId ?? mensalidadeRow?.aluno_id ?? null;
        turmaId = turmaId ?? mensalidadeRow?.turma_id ?? null;
        anoReferencia = mensalidadeRow?.ano_referencia ?? null;
      }

      if (needsAluno && alunoId) {
        const { data: aluno } = await supabase
          .from("alunos" as any)
          .select("nome, bi_numero")
          .eq("id", alunoId)
          .maybeSingle();
        const alunoRow = aluno as { nome?: string | null; bi_numero?: string | null } | null;
        enrichedSnapshot.aluno_nome = enrichedSnapshot.aluno_nome ?? alunoRow?.nome ?? null;
        enrichedSnapshot.aluno_bi = enrichedSnapshot.aluno_bi ?? alunoRow?.bi_numero ?? null;
      }

      if (needsTurma && !turmaId && alunoId && anoReferencia) {
        const { data: historico } = await supabase
          .from("historico_anos" as any)
          .select("turma_id")
          .eq("aluno_id", alunoId)
          .eq("ano_letivo", anoReferencia)
          .order("data_fechamento", { ascending: false })
          .limit(1)
          .maybeSingle();
        const historicoRow = historico as { turma_id?: string | null } | null;
        turmaId = historicoRow?.turma_id ?? null;
      }

      if (needsTurma && turmaId) {
        const { data: turma } = await supabase
          .from("turmas" as any)
          .select("nome, turno, classe_id, curso_id")
          .eq("id", turmaId)
          .maybeSingle();
        const turmaRow = turma as { nome?: string | null; turno?: string | null; classe_id?: string | null; curso_id?: string | null } | null;
        enrichedSnapshot.turma_nome = enrichedSnapshot.turma_nome ?? turmaRow?.nome ?? null;
        enrichedSnapshot.turma_turno = enrichedSnapshot.turma_turno ?? turmaRow?.turno ?? null;

        if (!enrichedSnapshot.classe_nome && turmaRow?.classe_id) {
          const { data: classe } = await supabase
            .from("classes" as any)
            .select("nome")
            .eq("id", turmaRow.classe_id)
            .maybeSingle();
          const classeRow = classe as { nome?: string | null } | null;
          enrichedSnapshot.classe_nome = classeRow?.nome ?? null;
        }

        if (!enrichedSnapshot.curso_nome && turmaRow?.curso_id) {
          const { data: curso } = await supabase
            .from("cursos" as any)
            .select("nome")
            .eq("id", turmaRow.curso_id)
            .maybeSingle();
          const cursoRow = curso as { nome?: string | null } | null;
          enrichedSnapshot.curso_nome = cursoRow?.nome ?? null;
        }
      }
    }
  }

  return {
    doc: {
      id: doc.id,
      public_id: doc.public_id,
      escola_id: doc.escola_id,
      tipo: doc.tipo,
      created_at: doc.created_at,
      hash_validacao: doc.hash_validacao ?? null,
      dados_snapshot: {
        ...enrichedSnapshot,
        hash_validacao: enrichedSnapshot.hash_validacao ?? doc.hash_validacao ?? null,
        numero_sequencial: doc.numero_sequencial ?? enrichedSnapshot.numero_sequencial ?? null,
      },
    },
    escolaNome: escolaInfoRow?.nome ?? "Escola",
    validationBaseUrl: escolaRow?.validation_base_url ?? null,
    logoUrl: escolaRow?.logo_url ?? null,
  } as const;
}
