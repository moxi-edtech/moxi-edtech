type EnsureEditableCurriculoArgs = {
  supabase: any;
  escolaId: string;
  cursoId: string;
  classeId: string;
  anoLetivoId?: string | null;
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

  let anoLetivoId = args.anoLetivoId
    ? String(args.anoLetivoId)
    : classRow?.ano_letivo_id
      ? String(classRow.ano_letivo_id)
      : null;
  if (!anoLetivoId) {
    const { data: activeYearRow, error: activeYearError } = await supabase
      .from("anos_letivos")
      .select("id")
      .eq("escola_id", escolaId)
      .eq("ativo", true)
      .order("ano", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeYearError) {
      throw new Error(activeYearError.message || "Falha ao carregar ano letivo ativo.");
    }
    if (!activeYearRow?.id) {
      throw new Error("Classe sem ano letivo associado e escola sem ano letivo ativo.");
    }
    anoLetivoId = String(activeYearRow.id);
  }

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

  let draftCurriculoId: string;
  let createdDraftStatus = true;

  if (createError) {
    if (createError.code === "23505") {
      // Concurrency race condition: another request created the draft just before this one.
      // Re-query the draft.
      const { data: retryDraft, error: retryError } = await supabase
        .from("curso_curriculos")
        .select("id")
        .eq("escola_id", escolaId)
        .eq("curso_id", cursoId)
        .eq("classe_id", classeId)
        .eq("ano_letivo_id", anoLetivoId)
        .eq("status", "draft")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (retryError || !retryDraft?.id) {
        throw new Error(retryError?.message || "Falha ao recuperar rascunho curricular concorrente.");
      }
      draftCurriculoId = String(retryDraft.id);
      createdDraftStatus = false;
    } else {
      throw new Error(createError.message || "Falha ao criar rascunho curricular.");
    }
  } else if (!createdDraft?.id) {
    throw new Error("Falha ao criar rascunho curricular (ID não retornado).");
  } else {
    draftCurriculoId = String(createdDraft.id);
  }

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
    createdDraft: createdDraftStatus,
  };
}
