BEGIN;

CREATE OR REPLACE FUNCTION public.emitir_documento_final(
  p_escola_id uuid,
  p_aluno_id uuid,
  p_ano_letivo int,
  p_tipo_documento text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_has_permission boolean;
  v_historico_ano record;
  v_aluno record;
  v_turma record;
  v_escola record;
  v_documento_emitido record;
  v_numero_sequencial int;
  v_hash_validacao text;
  v_snapshot jsonb;
  v_escola_id uuid := public.current_tenant_escola_id();
  v_regime text;
  v_diretora_nome text;
  v_pai_nome text;
  v_mae_nome text;
  v_media_final numeric;
BEGIN
  IF v_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  SELECT public.user_has_role_in_school(v_escola_id, ARRAY['secretaria', 'admin', 'admin_escola'])
  INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  SELECT * INTO v_historico_ano
  FROM public.historico_anos
  WHERE escola_id = v_escola_id
    AND aluno_id = p_aluno_id
    AND ano_letivo = p_ano_letivo;

  IF v_historico_ano.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Histórico para o ano letivo % não encontrado para este aluno. O ano precisa ser finalizado primeiro.', p_ano_letivo;
  END IF;

  IF COALESCE(v_historico_ano.snapshot_status, 'aberto') <> 'fechado' THEN
    RAISE EXCEPTION 'LEGAL_LOCK: histórico precisa estar em estado fechado para emissão de documento final.';
  END IF;

  SELECT *
  INTO v_aluno
  FROM public.alunos
  WHERE id = p_aluno_id
    AND escola_id = v_escola_id;

  IF v_aluno.id IS NULL THEN
    RAISE EXCEPTION 'DATA: aluno não encontrado para emissão do documento.';
  END IF;

  SELECT
    t.id,
    t.nome,
    t.turno,
    cl.nome AS classe_nome,
    cu.nome AS curso_nome
  INTO v_turma
  FROM public.turmas t
  LEFT JOIN public.classes cl ON cl.id = t.classe_id
  LEFT JOIN public.cursos cu ON cu.id = t.curso_id
  WHERE t.id = v_historico_ano.turma_id
    AND t.escola_id = v_escola_id;

  IF v_turma.id IS NULL THEN
    RAISE EXCEPTION 'DATA: turma do histórico não encontrada para este aluno.';
  END IF;

  SELECT *
  INTO v_escola
  FROM public.escolas
  WHERE id = v_escola_id;

  v_regime := CASE
    WHEN lower(coalesce(v_turma.turno, '')) LIKE '%noite%' THEN 'Noturno'
    WHEN nullif(trim(coalesce(v_turma.turno, '')), '') IS NOT NULL THEN 'Diurno'
    ELSE NULL
  END;

  v_diretora_nome := COALESCE(
    NULLIF(TRIM(COALESCE(to_jsonb(v_escola)->>'diretora_nome', '')), ''),
    NULLIF(TRIM(COALESCE(to_jsonb(v_escola)->>'diretor_nome', '')), ''),
    NULLIF(TRIM(COALESCE(to_jsonb(v_escola)->>'responsavel', '')), '')
  );

  v_pai_nome := COALESCE(
    NULLIF(TRIM(COALESCE(to_jsonb(v_aluno)->>'pai_nome', '')), ''),
    NULLIF(TRIM(COALESCE(to_jsonb(v_aluno)->>'nome_pai', '')), '')
  );

  v_mae_nome := COALESCE(
    NULLIF(TRIM(COALESCE(to_jsonb(v_aluno)->>'mae_nome', '')), ''),
    NULLIF(TRIM(COALESCE(to_jsonb(v_aluno)->>'nome_mae', '')), '')
  );

  v_media_final := COALESCE(
    NULLIF(to_jsonb(v_historico_ano)->>'media_final', '')::numeric,
    NULLIF(to_jsonb(v_historico_ano)->>'media_geral', '')::numeric
  );

  SELECT public.next_documento_numero(v_escola_id) INTO v_numero_sequencial;
  v_hash_validacao := encode(sha256(random()::text::bytea), 'hex');

  v_snapshot := jsonb_build_object(
    'aluno_id', p_aluno_id,
    'aluno_nome', COALESCE(v_aluno.nome_completo, v_aluno.nome),
    'aluno_bi', v_aluno.bi_numero,
    'pai_nome', v_pai_nome,
    'mae_nome', v_mae_nome,
    'data_nascimento', v_aluno.data_nascimento,
    'naturalidade', v_aluno.naturalidade,
    'provincia', v_aluno.provincia,
    'bi_emitido_em', NULLIF(TRIM(COALESCE(to_jsonb(v_aluno)->>'bi_emitido_em', '')), ''),
    'processo_individual_numero', v_aluno.numero_processo,
    'matricula_id', v_historico_ano.matricula_id,
    'turma_id', v_historico_ano.turma_id,
    'turma_nome', v_turma.nome,
    'turma_turno', v_turma.turno,
    'classe_concluida', v_turma.classe_nome,
    'curso_nome', v_turma.curso_nome,
    'area_formacao', v_turma.curso_nome,
    'regime', v_regime,
    'ano_letivo', v_historico_ano.ano_letivo,
    'status_final', v_historico_ano.status_final,
    'snapshot_status', v_historico_ano.snapshot_status,
    'snapshot_locked_at', v_historico_ano.snapshot_locked_at,
    'media_final', v_media_final,
    'escola_nome', v_escola.nome,
    'diretora_nome', v_diretora_nome,
    'tipo_documento', p_tipo_documento,
    'numero_sequencial', v_numero_sequencial,
    'hash_validacao', v_hash_validacao
  );

  INSERT INTO public.documentos_emitidos
    (escola_id, aluno_id, numero_sequencial, tipo, dados_snapshot, created_by, hash_validacao)
  VALUES
    (v_escola_id, p_aluno_id, v_numero_sequencial, p_tipo_documento, v_snapshot, v_actor_id, v_hash_validacao)
  RETURNING * INTO v_documento_emitido;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    v_escola_id,
    v_actor_id,
    'DOCUMENTO_FINAL_EMITIDO',
    'documentos_emitidos',
    v_documento_emitido.id::text,
    'secretaria',
    v_snapshot
  );

  RETURN jsonb_build_object(
    'ok', true,
    'docId', v_documento_emitido.id,
    'publicId', v_documento_emitido.public_id,
    'hash', v_documento_emitido.hash_validacao,
    'tipo', v_documento_emitido.tipo
  );
END;
$$;

COMMIT;
