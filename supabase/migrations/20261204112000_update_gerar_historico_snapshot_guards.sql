BEGIN;

CREATE OR REPLACE FUNCTION public.gerar_historico_anual(
  p_matricula_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_matricula record;
  v_historico_ano_id uuid;
  boletim_row record;
  v_escola_id uuid := public.current_tenant_escola_id();
  v_has_permission boolean;
  v_snapshot_lock record;
BEGIN
  IF v_escola_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: escola_id não resolvido.';
  END IF;

  SELECT * INTO v_matricula FROM public.matriculas WHERE id = p_matricula_id AND escola_id = v_escola_id;
  IF v_matricula.id IS NULL THEN
    RAISE EXCEPTION 'Matrícula com ID % não encontrada.', p_matricula_id;
  END IF;

  SELECT public.user_has_role_in_school(v_escola_id, ARRAY['secretaria', 'admin', 'admin_escola'])
  INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  SELECT hsl.* INTO v_snapshot_lock
  FROM public.historico_snapshot_locks hsl
  WHERE hsl.escola_id = v_escola_id
    AND hsl.matricula_id = p_matricula_id
  ORDER BY hsl.updated_at DESC
  LIMIT 1;

  IF v_snapshot_lock.id IS NOT NULL AND v_snapshot_lock.status = 'fechado' THEN
    RAISE EXCEPTION 'LEGAL_LOCK: Histórico legal já congelado para esta matrícula. Reabertura auditada obrigatória.';
  END IF;

  INSERT INTO public.historico_anos (escola_id, aluno_id, ano_letivo, ano_letivo_id, turma_id, matricula_id, status_final, snapshot_status)
  VALUES (
    v_matricula.escola_id,
    v_matricula.aluno_id,
    v_matricula.ano_letivo,
    v_matricula.ano_letivo_id,
    v_matricula.turma_id,
    p_matricula_id,
    v_matricula.status,
    'aberto'
  )
  ON CONFLICT (escola_id, aluno_id, ano_letivo) DO UPDATE SET
    turma_id = EXCLUDED.turma_id,
    matricula_id = EXCLUDED.matricula_id,
    ano_letivo_id = EXCLUDED.ano_letivo_id,
    status_final = EXCLUDED.status_final
  RETURNING id INTO v_historico_ano_id;

  FOR boletim_row IN
    SELECT *
    FROM public.vw_boletim_por_matricula
    WHERE matricula_id = p_matricula_id
  LOOP
    INSERT INTO public.historico_disciplinas (
      historico_ano_id,
      disciplina_id,
      disciplina_nome,
      nota_final,
      status_final,
      notas_detalhe
    )
    VALUES (
      v_historico_ano_id,
      boletim_row.disciplina_id,
      boletim_row.disciplina_nome,
      boletim_row.nota_final,
      CASE
        WHEN boletim_row.nota_final >= 9.5 THEN 'aprovado'
        ELSE 'reprovado'
      END,
      boletim_row.notas_por_tipo
    )
    ON CONFLICT (historico_ano_id, disciplina_id) DO UPDATE SET
      disciplina_nome = EXCLUDED.disciplina_nome,
      nota_final = EXCLUDED.nota_final,
      status_final = EXCLUDED.status_final,
      notas_detalhe = EXCLUDED.notas_detalhe;
  END LOOP;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    v_matricula.escola_id,
    auth.uid(),
    'HISTORICO_ANUAL_GERADO',
    'historico_anos',
    v_historico_ano_id::text,
    'system',
    jsonb_build_object(
      'matricula_id', p_matricula_id,
      'status_final_matricula', v_matricula.status,
      'snapshot_status', 'aberto'
    )
  );

  RETURN v_historico_ano_id;
END;
$$;

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
  v_documento_emitido record;
  v_numero_sequencial int;
  v_hash_validacao text;
  v_snapshot jsonb;
  v_escola_id uuid := public.current_tenant_escola_id();
BEGIN
  IF v_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  SELECT public.user_has_role_in_school(v_escola_id, ARRAY['secretaria', 'admin', 'admin_escola'])
  INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  SELECT * INTO v_historico_ano FROM public.historico_anos
  WHERE escola_id = v_escola_id AND aluno_id = p_aluno_id AND ano_letivo = p_ano_letivo;

  IF v_historico_ano.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Histórico para o ano letivo % não encontrado para este aluno. O ano precisa ser finalizado primeiro.', p_ano_letivo;
  END IF;

  IF COALESCE(v_historico_ano.snapshot_status, 'aberto') <> 'fechado' THEN
    RAISE EXCEPTION 'LEGAL_LOCK: histórico precisa estar em estado fechado para emissão de documento final.';
  END IF;

  SELECT nome, bi_numero INTO v_aluno FROM public.alunos WHERE id = p_aluno_id;
  SELECT nome, turno INTO v_turma FROM public.turmas WHERE id = v_historico_ano.turma_id;

  SELECT public.next_documento_numero(v_escola_id) INTO v_numero_sequencial;
  v_hash_validacao := encode(sha256(random()::text::bytea), 'hex');

  v_snapshot := jsonb_build_object(
    'aluno_id', p_aluno_id,
    'aluno_nome', v_aluno.nome,
    'aluno_bi', v_aluno.bi_numero,
    'matricula_id', v_historico_ano.matricula_id,
    'turma_id', v_historico_ano.turma_id,
    'turma_nome', v_turma.nome,
    'turma_turno', v_turma.turno,
    'ano_letivo', v_historico_ano.ano_letivo,
    'status_final', v_historico_ano.status_final,
    'snapshot_status', v_historico_ano.snapshot_status,
    'snapshot_locked_at', v_historico_ano.snapshot_locked_at,
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
