type EnsureEditableCurriculoArgs = {
  supabase: any;
  escolaId: string;
  cursoId: string;
  classeId: string;
};

type EnsureEditableCurriculoResult = {
  draftCurriculoId: string;
  anoLetivoId: string;
  createdDraft: boolean;
};

export async function ensureEditableCurriculoForClass(
  args: EnsureEditableCurriculoArgs
): Promise<EnsureEditableCurriculoResult> {
  const { supabase, escolaId, cursoId, classeId } = args;

  const { data: classRow, error: classError } = await supabase
    .from("classes")
    .select("id, ano_letivo_id")
    .eq("escola_id", escolaId)
    .eq("curso_id", cursoId)
    .eq("id", classeId)
    .maybeSingle();

  if (classError) {
    throw new Error(classError.message || "Falha ao carregar classe.");
  }
  if (!classRow?.ano_letivo_id) {
    throw new Error("Classe sem ano letivo associado.");
  }

  const anoLetivoId = String(classRow.ano_letivo_id);

  const { data: draftCurriculo, error: draftError } = await supabase
    .from("curso_curriculos")
    .select("id, version")
    .eq("escola_id", escolaId)
    .eq("curso_id", cursoId)
    .eq("classe_id", classeId)
    .eq("ano_letivo_id", anoLetivoId)
    .eq("status", "draft")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (draftError) {
    throw new Error(draftError.message || "Falha ao carregar rascunho curricular.");
  }

  if (draftCurriculo?.id) {
    return {
      draftCurriculoId: String(draftCurriculo.id),
      anoLetivoId,
      createdDraft: false,
    };
  }

  const { data: latestCurriculo, error: latestError } = await supabase
    .from("curso_curriculos")
    .select("id, version, status")
    .eq("escola_id", escolaId)
    .eq("curso_id", cursoId)
    .eq("classe_id", classeId)
    .eq("ano_letivo_id", anoLetivoId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    throw new Error(latestError.message || "Falha ao carregar currículo atual.");
  }

  const nextVersion = Number(latestCurriculo?.version ?? 0) + 1;
  const { data: createdDraft, error: createError } = await supabase
    .from("curso_curriculos")
    .insert({
      escola_id: escolaId,
      curso_id: cursoId,
      classe_id: classeId,
      ano_letivo_id: anoLetivoId,
      version: nextVersion,
      status: "draft",
    })
    .select("id")
    .single();

  if (createError || !createdDraft?.id) {
    throw new Error(createError?.message || "Falha ao criar rascunho curricular.");
  }

  const draftCurriculoId = String(createdDraft.id);

  if (latestCurriculo?.id && latestCurriculo.status === "published") {
    const { data: publishedRows, error: publishedError } = await supabase
      .from("curso_matriz")
      .select(
        "disciplina_id, classe_id, curso_id, obrigatoria, ordem, ativo, carga_horaria, carga_horaria_semanal, classificacao, periodos_ativos, entra_no_horario, avaliacao_mode, avaliacao_modelo_id, avaliacao_disciplina_id, modelo_excecao_id, status_completude, conta_para_media_med"
      )
      .eq("escola_id", escolaId)
      .eq("curso_curriculo_id", latestCurriculo.id)
      .eq("classe_id", classeId);

    if (publishedError) {
      throw new Error(publishedError.message || "Falha ao copiar currículo publicado.");
    }

    if ((publishedRows ?? []).length > 0) {
      const rowsToInsert = (publishedRows ?? []).map((row: any) => ({
        ...row,
        escola_id: escolaId,
        curso_curriculo_id: draftCurriculoId,
      }));

      const { error: copyError } = await supabase
        .from("curso_matriz")
        .insert(rowsToInsert);

      if (copyError && copyError.code !== "23505") {
        throw new Error(copyError.message || "Falha ao materializar rascunho curricular.");
      }
    }
  }

  return {
    draftCurriculoId,
    anoLetivoId,
    createdDraft: true,
  };
}
