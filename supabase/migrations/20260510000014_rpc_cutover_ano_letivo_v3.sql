BEGIN;

CREATE OR REPLACE FUNCTION public.rematricula_em_massa(
  p_escola_id uuid,
  p_origem_turma_id uuid,
  p_destino_turma_id uuid
)
RETURNS TABLE(inserted jsonb, skipped jsonb, errors jsonb)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_origem_ano int;
  v_dest_session uuid;
  v_dest_ano int;
  v_exame_fim date;
  v_errs jsonb := '[]'::jsonb;
  v_inserted jsonb := '[]'::jsonb;
  v_skipped jsonb := '[]'::jsonb;
  v_bloquear_inadimplentes boolean := false;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.turmas t
    WHERE t.id = p_origem_turma_id
      AND t.escola_id = p_escola_id
  ) THEN
    RAISE EXCEPTION 'Turma de origem não pertence à escola';
  END IF;

  SELECT t.session_id, t.ano_letivo
    INTO v_dest_session, v_dest_ano
  FROM public.turmas t
  WHERE t.id = p_destino_turma_id
    AND t.escola_id = p_escola_id
  LIMIT 1;

  SELECT t.ano_letivo
    INTO v_origem_ano
  FROM public.turmas t
  WHERE t.id = p_origem_turma_id
    AND t.escola_id = p_escola_id
  LIMIT 1;

  IF v_dest_session IS NULL OR v_dest_ano IS NULL THEN
    RAISE EXCEPTION 'Turma de destino inválida ou sem sessão vinculada';
  END IF;

  SELECT MAX(data_fim)
    INTO v_exame_fim
  FROM public.calendario_eventos
  WHERE escola_id = p_escola_id
    AND tipo = 'EXAME_NACIONAL'
    AND ano_letivo_id IN (
      SELECT al.id
      FROM public.anos_letivos al
      WHERE al.escola_id = p_escola_id
        AND al.ano = v_origem_ano
    );

  IF v_exame_fim IS NOT NULL AND CURRENT_DATE <= v_exame_fim THEN
    RAISE EXCEPTION 'BLOQUEIO: A transição de ano não é permitida antes do término dos Exames Nacionais (%s).',
      to_char(v_exame_fim, 'DD/MM/YYYY');
  END IF;

  SELECT COALESCE(cf.bloquear_inadimplentes, false)
    INTO v_bloquear_inadimplentes
  FROM public.configuracoes_financeiro cf
  WHERE cf.escola_id = p_escola_id
  LIMIT 1;

  WITH origem_alunos AS (
    SELECT m.aluno_id, m.id AS matricula_id, m.status, m.ano_letivo
    FROM public.matriculas m
    WHERE m.escola_id = p_escola_id
      AND m.turma_id = p_origem_turma_id
      AND lower(coalesce(m.status, '')) IN (
        'ativo',
        'ativa',
        'active',
        'concluido',
        'concluida',
        'aprovado',
        'aprovada',
        'reprovado',
        'reprovada',
        'reprovado_por_faltas'
      )
  ), ja_ativos_dest AS (
    SELECT m.aluno_id
    FROM public.matriculas m
    WHERE m.escola_id = p_escola_id
      AND m.session_id = v_dest_session
      AND lower(coalesce(m.status, '')) IN ('ativo','ativa','active')
  ), candidatos AS (
    SELECT
      o.aluno_id,
      o.matricula_id,
      o.ano_letivo,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN j.aluno_id IS NOT NULL THEN 'ja_ativo' END,
        CASE WHEN lower(coalesce(o.status, '')) IN ('reprovado','reprovada','reprovado_por_faltas') THEN 'reprovacao' END,
        CASE WHEN v_bloquear_inadimplentes AND EXISTS (
          SELECT 1
          FROM public.mensalidades ms
          WHERE ms.escola_id = p_escola_id
            AND ms.aluno_id = o.aluno_id
            AND ms.ano_referencia = o.ano_letivo
            AND ms.status IN ('pendente','pago_parcial')
            AND ms.data_vencimento < CURRENT_DATE
        ) THEN 'inadimplencia' END
      ], NULL) AS motivos
    FROM origem_alunos o
    LEFT JOIN ja_ativos_dest j ON j.aluno_id = o.aluno_id
  ), to_insert AS (
    SELECT *
    FROM candidatos
    WHERE array_length(motivos, 1) IS NULL
  ), ins AS (
    INSERT INTO public.matriculas (
      id,
      escola_id,
      aluno_id,
      turma_id,
      session_id,
      ano_letivo,
      status,
      ativo,
      created_at,
      data_matricula
    )
    SELECT
      gen_random_uuid(),
      p_escola_id,
      c.aluno_id,
      p_destino_turma_id,
      v_dest_session,
      v_dest_ano,
      'ativo',
      true,
      now(),
      CURRENT_DATE
    FROM to_insert c
    RETURNING id, aluno_id
  )
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('matricula_id', i.id, 'aluno_id', i.aluno_id)),
    '[]'::jsonb
  )
  INTO v_inserted
  FROM ins i;

  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('matricula_id', c.matricula_id, 'aluno_id', c.aluno_id, 'motivos', c.motivos)),
    '[]'::jsonb
  )
  INTO v_skipped
  FROM candidatos c
  WHERE array_length(c.motivos, 1) IS NOT NULL;

  UPDATE public.matriculas m
     SET status = 'transferido',
         updated_at = now()
   WHERE m.escola_id = p_escola_id
     AND m.turma_id = p_origem_turma_id
     AND lower(coalesce(m.status, '')) IN ('ativo','ativa','active')
     AND m.aluno_id IN (SELECT aluno_id FROM to_insert);

  RETURN QUERY SELECT v_inserted AS inserted,
                      v_skipped AS skipped,
                      v_errs AS errors;
END;
$$;

CREATE OR REPLACE FUNCTION public.cutover_ano_letivo_v3(
  p_escola_id uuid,
  p_from_session_id uuid,
  p_to_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_escola_id uuid := public.current_tenant_escola_id();
  v_actor_id uuid := auth.uid();
  v_has_permission boolean;
  v_from_ano int;
  v_to_ano int;
  v_pautas_pendentes int := 0;
  v_matriculas_sem_final int := 0;
  v_snapshot_pendentes int := 0;
  v_curriculos_pendentes int := 0;
  v_target_missing int := 0;
  v_processed_turmas int := 0;
  v_summary jsonb := '[]'::jsonb;
  v_row record;
  v_run_id uuid := gen_random_uuid();
  v_result record;
BEGIN
  IF v_tenant_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_tenant_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id invalido.';
  END IF;

  SELECT public.user_has_role_in_school(v_tenant_escola_id, ARRAY['admin', 'admin_escola'])
    INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: permissao negada.';
  END IF;

  IF p_from_session_id = p_to_session_id THEN
    RAISE EXCEPTION 'VALIDATION: sessoes de origem e destino devem ser diferentes.';
  END IF;

  SELECT ano
    INTO v_from_ano
  FROM public.anos_letivos
  WHERE id = p_from_session_id
    AND escola_id = p_escola_id
  FOR UPDATE;

  SELECT ano
    INTO v_to_ano
  FROM public.anos_letivos
  WHERE id = p_to_session_id
    AND escola_id = p_escola_id
  FOR UPDATE;

  IF v_from_ano IS NULL OR v_to_ano IS NULL THEN
    RAISE EXCEPTION 'VALIDATION: ano letivo de origem/destino invalido.';
  END IF;

  IF v_to_ano <= v_from_ano THEN
    RAISE EXCEPTION 'VALIDATION: ano letivo destino deve ser posterior ao ano origem.';
  END IF;

  SELECT count(*)
    INTO v_pautas_pendentes
  FROM public.turmas t
  WHERE t.escola_id = p_escola_id
    AND t.session_id = p_from_session_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.pautas_oficiais po
      WHERE po.escola_id = p_escola_id
        AND po.turma_id = t.id
        AND po.tipo = 'anual'
        AND po.status = 'SUCCESS'
        AND EXISTS (
          SELECT 1
          FROM public.periodos_letivos pl
          WHERE pl.id = po.periodo_letivo_id
            AND pl.escola_id = p_escola_id
            AND pl.ano_letivo_id = p_from_session_id
        )
    );

  SELECT count(*)
    INTO v_matriculas_sem_final
  FROM public.matriculas m
  WHERE m.escola_id = p_escola_id
    AND m.session_id = p_from_session_id
    AND lower(coalesce(m.status, '')) NOT IN (
      'concluido',
      'reprovado',
      'reprovada',
      'reprovado_por_faltas',
      'transferido',
      'inativo',
      'desistente',
      'trancado'
    );

  SELECT count(*)
    INTO v_snapshot_pendentes
  FROM public.matriculas m
  WHERE m.escola_id = p_escola_id
    AND m.session_id = p_from_session_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.historico_snapshot_locks hsl
      WHERE hsl.escola_id = p_escola_id
        AND hsl.ano_letivo_id = p_from_session_id
        AND hsl.matricula_id = m.id
        AND hsl.status = 'fechado'
    );

  WITH target_classes AS (
    SELECT DISTINCT t.curso_id, t.classe_id
    FROM public.turmas t
    WHERE t.escola_id = p_escola_id
      AND t.session_id = p_to_session_id
  ), published AS (
    SELECT DISTINCT cc.curso_id, cc.classe_id
    FROM public.curso_curriculos cc
    WHERE cc.escola_id = p_escola_id
      AND cc.ano_letivo_id = p_to_session_id
      AND cc.status = 'published'
      AND cc.classe_id IS NOT NULL
  )
  SELECT count(*)
    INTO v_curriculos_pendentes
  FROM target_classes tc
  WHERE NOT EXISTS (
    SELECT 1
    FROM published p
    WHERE p.curso_id = tc.curso_id
      AND p.classe_id = tc.classe_id
  );

  WITH concluded_source AS (
    SELECT DISTINCT t.id, t.curso_id, t.turno, t.letra, t.classe_num
    FROM public.turmas t
    JOIN public.matriculas m
      ON m.turma_id = t.id
     AND m.escola_id = p_escola_id
     AND m.session_id = p_from_session_id
     AND lower(coalesce(m.status, '')) IN ('concluido','concluida','aprovado','aprovada')
    WHERE t.escola_id = p_escola_id
      AND t.session_id = p_from_session_id
      AND EXISTS (
        SELECT 1
        FROM public.classes c_next
        WHERE c_next.escola_id = p_escola_id
          AND c_next.curso_id = t.curso_id
          AND c_next.numero = t.classe_num + 1
      )
  )
  SELECT count(*)
    INTO v_target_missing
  FROM concluded_source s
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.turmas t_dest
    WHERE t_dest.escola_id = p_escola_id
      AND t_dest.session_id = p_to_session_id
      AND t_dest.curso_id = s.curso_id
      AND t_dest.classe_num = s.classe_num + 1
      AND t_dest.turno IS NOT DISTINCT FROM s.turno
      AND t_dest.letra IS NOT DISTINCT FROM s.letra
  );

  IF v_pautas_pendentes > 0
     OR v_matriculas_sem_final > 0
     OR v_snapshot_pendentes > 0
     OR v_curriculos_pendentes > 0
     OR v_target_missing > 0 THEN
    RAISE EXCEPTION 'PREREQUISITE_FAILED: pautas=%, matriculas_sem_final=%, snapshots=%, curriculos_destino=%, turmas_destino=%',
      v_pautas_pendentes,
      v_matriculas_sem_final,
      v_snapshot_pendentes,
      v_curriculos_pendentes,
      v_target_missing;
  END IF;

  FOR v_row IN
    SELECT
      t_old.id AS origem_turma_id,
      t_dest.id AS destino_turma_id
    FROM public.turmas t_old
    JOIN public.turmas t_dest
      ON t_dest.escola_id = p_escola_id
     AND t_dest.session_id = p_to_session_id
     AND t_dest.curso_id = t_old.curso_id
     AND t_dest.classe_num = t_old.classe_num + 1
     AND t_dest.turno IS NOT DISTINCT FROM t_old.turno
     AND t_dest.letra IS NOT DISTINCT FROM t_old.letra
    WHERE t_old.escola_id = p_escola_id
      AND t_old.session_id = p_from_session_id
  LOOP
    SELECT *
      INTO v_result
    FROM public.rematricula_em_massa(p_escola_id, v_row.origem_turma_id, v_row.destino_turma_id);

    v_processed_turmas := v_processed_turmas + 1;
    v_summary := v_summary || jsonb_build_array(jsonb_build_object(
      'origem_turma_id', v_row.origem_turma_id,
      'destino_turma_id', v_row.destino_turma_id,
      'inserted', v_result.inserted,
      'skipped', v_result.skipped,
      'errors', v_result.errors
    ));
  END LOOP;

  UPDATE public.anos_letivos
     SET ativo = (id = p_to_session_id),
         updated_at = now()
   WHERE escola_id = p_escola_id;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, details, portal)
  VALUES (
    p_escola_id,
    v_actor_id,
    'ANO_LETIVO_CUTOVER_V3',
    'anos_letivos',
    p_to_session_id::text,
    jsonb_build_object(
      'run_id', v_run_id,
      'from_session_id', p_from_session_id,
      'to_session_id', p_to_session_id,
      'from_ano', v_from_ano,
      'to_ano', v_to_ano,
      'processed_turmas', v_processed_turmas,
      'rematricula_summary', v_summary,
      'at', now()
    ),
    'admin'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'run_id', v_run_id,
    'from_session_id', p_from_session_id,
    'to_session_id', p_to_session_id,
    'processed_turmas', v_processed_turmas,
    'rematricula_summary', v_summary
  );
END;
$$;

COMMIT;
