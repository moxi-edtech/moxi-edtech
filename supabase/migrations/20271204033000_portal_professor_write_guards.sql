-- Guard professor writes at the canonical database boundary, preserving the
-- historical staff exception, scale, tenant/assignment checks and audit in the
-- existing writer. No new role grants, tables or parallel grade writers.
BEGIN;

CREATE OR REPLACE FUNCTION public.lancar_notas_batch(p_escola_id uuid, p_turma_id uuid, p_disciplina_id uuid, p_turma_disciplina_id uuid, p_trimestre integer, p_tipo_avaliacao text, p_notas jsonb, p_is_isento boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
DECLARE
  v_actor_id uuid := public.safe_auth_uid();
  v_claims jsonb := '{}'::jsonb;
  v_is_service_role boolean := false;
  v_is_staff boolean := false;
  v_can_write_pending boolean := false;
  v_professor_id uuid;
  v_turma record;
  v_turma_disciplina record;
  v_disciplina_matriz_id uuid;
  v_ano_ativo boolean := false;
  v_hist_mat uuid;
  v_periodo_letivo_id uuid;
  v_regime jsonb;
  v_escala text;
  v_nota_max numeric(6,2);
  v_avaliacao_id uuid;
  v_matricula_id uuid;
  v_aluno_id uuid;
  v_valor numeric;
  v_rows_to_upsert jsonb[] := '{}';
  nota_record jsonb;
  v_inserted_count bigint := 0;
  v_updated_count bigint := 0;
  v_portal text := 'professor';
  v_guarded boolean := false;
  v_versions jsonb := '{}'::jsonb;
BEGIN
  BEGIN
    v_claims := COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    v_claims := '{}'::jsonb;
  END;

  v_is_service_role :=
    COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') = 'service_role'
    OR COALESCE(v_claims->>'role', '') = 'service_role';

  IF p_notas IS NULL OR jsonb_typeof(p_notas) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'DATA: O lote de notas deve ser um array.';
  END IF;

  IF jsonb_array_length(p_notas) < 1 OR jsonb_array_length(p_notas) > 50 THEN
    RAISE EXCEPTION 'DATA: O lote de notas deve conter entre 1 e 50 alunos.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT item->>'aluno_id' AS aluno_id
      FROM jsonb_array_elements(p_notas) AS item
      GROUP BY item->>'aluno_id'
      HAVING count(*) > 1
    ) duplicated
  ) THEN
    RAISE EXCEPTION 'DATA: O lote contém aluno_id duplicado.';
  END IF;

  SELECT COALESCE(bool_or(value ? 'expected'), false) INTO v_guarded FROM jsonb_array_elements(p_notas);

  IF p_trimestre NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'DATA: Trimestre inválido.';
  END IF;

  IF NULLIF(btrim(COALESCE(p_tipo_avaliacao, '')), '') IS NULL
     OR length(btrim(p_tipo_avaliacao)) > 40 THEN
    RAISE EXCEPTION 'DATA: Tipo de avaliação inválido.';
  END IF;

  IF NOT v_is_service_role THEN
    IF v_actor_id IS NULL THEN
      RAISE EXCEPTION 'AUTH: Utilizador não autenticado.';
    END IF;

    IF public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id THEN
      RAISE EXCEPTION 'AUTH: Escola fora do tenant ativo.';
    END IF;

    v_is_staff := public.user_has_role_in_school(
      p_escola_id,
      ARRAY[
        'secretaria',
        'secretaria_financeiro',
        'admin_financeiro',
        'admin_secretaria',
        'admin_secretario',
        'admin',
        'admin_escola',
        'staff_admin',
        'diretor'
      ]
    );

    -- The existing staff set includes financial roles. Those roles must
    -- NOT gain new powers over a pending academic record.
    -- user_has_role_in_school expands 'secretaria' to financial roles.
    -- For an exceptional pending-grade write we intentionally use exact roles.
    v_can_write_pending := EXISTS (
      SELECT 1 FROM public.escola_users eu
      WHERE eu.escola_id = p_escola_id AND eu.user_id = v_actor_id
        AND eu.papel IN ('secretaria','admin_secretaria','admin_secretario','admin_financeiro','admin','admin_escola','staff_admin','diretor')
    );

    IF NOT v_is_staff THEN
      SELECT p.id
      INTO v_professor_id
      FROM public.professores p
      WHERE p.profile_id = v_actor_id
        AND p.escola_id = p_escola_id
      LIMIT 1;

      IF v_professor_id IS NULL THEN
        RAISE EXCEPTION 'AUTH: Professor não encontrado para este utilizador.';
      END IF;
    ELSE
      v_portal := 'secretaria';
    END IF;
  ELSE
    v_portal := 'service_role';
  END IF;

  SELECT
    t.id,
    t.escola_id,
    t.session_id,
    t.ano_letivo,
    t.status_fecho
  INTO v_turma
  FROM public.turmas t
  WHERE t.id = p_turma_id
    AND t.escola_id = p_escola_id;

  IF v_turma.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Turma não encontrada.';
  END IF;

  IF v_turma.session_id IS NULL THEN
    RAISE EXCEPTION 'DATA: Turma sem vínculo ao ano letivo canónico.';
  END IF;

  SELECT COALESCE(al.ativo, false)
  INTO v_ano_ativo
  FROM public.anos_letivos al
  WHERE al.id = v_turma.session_id
    AND al.escola_id = p_escola_id
    AND al.ano = v_turma.ano_letivo;

  IF NOT COALESCE(v_ano_ativo, false) THEN
    IF jsonb_array_length(p_notas) <> 1 OR v_is_service_role THEN
      RAISE EXCEPTION 'ACADEMIC_YEAR_READ_ONLY: só correção histórica individual autorizada'
        USING ERRCODE='42501';
    END IF;
    SELECT m.id INTO v_hist_mat
    FROM public.matriculas m
    WHERE m.escola_id=p_escola_id AND m.turma_id=p_turma_id
      AND m.session_id=v_turma.session_id
      AND m.aluno_id=(p_notas->0->>'aluno_id')::uuid
      AND public.can_write_historical_grade(p_escola_id,m.id,v_actor_id)
    LIMIT 1;
    IF v_hist_mat IS NULL THEN
      RAISE EXCEPTION 'ACADEMIC_YEAR_READ_ONLY: autorização histórica individual inexistente'
        USING ERRCODE='42501';
    END IF;
  END IF;

  SELECT
    td.id,
    td.professor_id,
    td.curso_matriz_id,
    td.periodos_ativos
  INTO v_turma_disciplina
  FROM public.turma_disciplinas td
  WHERE td.id = p_turma_disciplina_id
    AND td.escola_id = p_escola_id
    AND td.turma_id = p_turma_id;

  IF v_turma_disciplina.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Disciplina não atribuída a esta turma.';
  END IF;
  IF COALESCE(cardinality(v_turma_disciplina.periodos_ativos),0) > 0
     AND NOT p_trimestre = ANY(v_turma_disciplina.periodos_ativos) THEN
    RAISE EXCEPTION 'DATA: Disciplina não lecionada neste trimestre.';
  END IF;

  SELECT cm.disciplina_id
  INTO v_disciplina_matriz_id
  FROM public.curso_matriz cm
  WHERE cm.id = v_turma_disciplina.curso_matriz_id
    AND cm.escola_id = p_escola_id;

  IF v_disciplina_matriz_id IS DISTINCT FROM p_disciplina_id THEN
    RAISE EXCEPTION 'DATA: A disciplina não corresponde à matriz atribuída à turma.';
  END IF;

  IF NOT v_is_service_role AND NOT v_is_staff THEN
    IF v_turma_disciplina.professor_id IS DISTINCT FROM v_professor_id THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.turma_disciplinas_professores tdp
        WHERE tdp.escola_id = p_escola_id
          AND tdp.turma_id = p_turma_id
          AND tdp.disciplina_id = p_disciplina_id
          AND tdp.professor_id = v_professor_id
      ) THEN
        RAISE EXCEPTION 'AUTH: Professor não atribuído a esta disciplina/turma.';
      END IF;
    END IF;
  END IF;

  IF NOT v_is_service_role AND NOT v_is_staff AND NOT v_guarded THEN
    RAISE EXCEPTION 'GRADE_REVISION_REQUIRED: recarregue a pauta antes de guardar.' USING ERRCODE = '40001';
  END IF;

  SELECT pl.id
  INTO v_periodo_letivo_id
  FROM public.periodos_letivos pl
  WHERE pl.escola_id = p_escola_id
    AND pl.ano_letivo_id = v_turma.session_id
    AND pl.tipo = 'TRIMESTRE'
    AND pl.numero = p_trimestre
    AND pl.offering_id IS NULL
  LIMIT 1;

  IF v_periodo_letivo_id IS NULL THEN
    RAISE EXCEPTION 'DATA: Período letivo não encontrado para o ano selecionado.';
  END IF;

  v_regime := public.resolve_regime_academico(p_turma_id);
  v_escala := COALESCE(v_regime->>'escala', '');

  IF v_escala = 'quantitativa_primario' THEN
    v_nota_max := 10;
  ELSIF v_escala = 'quantitativa_secundario' THEN
    v_nota_max := 20;
  ELSE
    RAISE EXCEPTION 'DATA: A escala académica % não aceita lançamento numérico neste fluxo.', NULLIF(v_escala, '');
  END IF;

  INSERT INTO public.avaliacoes (
    escola_id,
    turma_disciplina_id,
    periodo_letivo_id,
    ano_letivo,
    trimestre,
    nome,
    tipo,
    peso,
    nota_max
  )
  VALUES (
    p_escola_id,
    p_turma_disciplina_id,
    v_periodo_letivo_id,
    v_turma.ano_letivo,
    p_trimestre,
    btrim(p_tipo_avaliacao),
    btrim(p_tipo_avaliacao),
    1,
    v_nota_max
  )
  ON CONFLICT (escola_id, turma_disciplina_id, ano_letivo, trimestre, tipo)
  DO UPDATE SET
    nome = EXCLUDED.nome,
    periodo_letivo_id = EXCLUDED.periodo_letivo_id,
    nota_max = EXCLUDED.nota_max
  RETURNING id INTO v_avaliacao_id;

  FOR nota_record IN SELECT value FROM jsonb_array_elements(p_notas)
  LOOP
    IF jsonb_typeof(nota_record) IS DISTINCT FROM 'object'
       OR NULLIF(nota_record->>'aluno_id', '') IS NULL THEN
      RAISE EXCEPTION 'DATA: aluno_id é obrigatório em todas as notas.';
    END IF;

    BEGIN
      v_aluno_id := (nota_record->>'aluno_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'DATA: aluno_id inválido: %.', nota_record->>'aluno_id';
    END;

    IF p_is_isento THEN
      v_valor := NULL;
    ELSIF nota_record->'valor' IS NULL OR jsonb_typeof(nota_record->'valor') = 'null' THEN
      v_valor := NULL;
    ELSE
      BEGIN
        v_valor := (nota_record->>'valor')::numeric;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'DATA: Nota inválida para o aluno %.', nota_record->>'aluno_id';
      END;

      IF v_valor < 0 OR v_valor > v_nota_max THEN
        RAISE EXCEPTION 'DATA: Nota deve estar entre 0 e % para esta turma.', v_nota_max;
      END IF;
    END IF;

    SELECT m.id
    INTO v_matricula_id
    FROM public.matriculas m
    WHERE m.escola_id = p_escola_id
      AND m.turma_id = p_turma_id
      AND m.aluno_id = v_aluno_id
      AND m.session_id = v_turma.session_id
      AND (
        m.ativo IS TRUE
        OR (
          v_hist_mat=m.id
          AND public.can_write_historical_grade(p_escola_id,m.id,v_actor_id)
        )
        OR (
          v_can_write_pending
          AND m.status = 'pendente'
          AND m.ativo IS FALSE
          AND m.status_fecho_origem IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM public.historico_anos h
            WHERE h.escola_id = m.escola_id AND h.matricula_id = m.id
              AND h.resultado_final IS NOT NULL
          )
        )
      )
    ORDER BY m.ativo DESC, m.created_at DESC
    LIMIT 1;

    IF v_matricula_id IS NULL THEN
      RAISE EXCEPTION 'DATA: Aluno % não possui matrícula ativa nesta turma e ano letivo.', nota_record->>'aluno_id';
    END IF;

    IF v_guarded AND (
      NOT (nota_record ? 'expected') OR
      (nota_record->>'matricula_id') IS DISTINCT FROM v_matricula_id::text OR
      (nota_record->'expected' <> 'null'::jsonb AND (
        jsonb_typeof(nota_record->'expected') IS DISTINCT FROM 'object' OR
        NOT ((nota_record->'expected') ?& ARRAY['id','updated_at','valor','is_isento']) OR
        NULLIF(nota_record->'expected'->>'id','') IS NULL
      ))
    ) THEN
      RAISE EXCEPTION 'GRADE_CONFLICT: a matrícula ou revisão da nota mudou; recarregue a pauta.' USING ERRCODE = '40001';
    END IF;

    v_rows_to_upsert := array_append(
      v_rows_to_upsert,
      jsonb_build_object(
        'escola_id', p_escola_id,
        'avaliacao_id', v_avaliacao_id,
        'matricula_id', v_matricula_id,
        'valor', v_valor,
        'is_isento', COALESCE(p_is_isento, false),
        'expected', nota_record->'expected'
      )
    );
  END LOOP;

  IF v_guarded THEN
    -- UPDATE checks the revision after acquiring the actual row lock. INSERT
    -- accepts only a previously absent row; a concurrent insert is a conflict.
    -- A mismatch rolls back every write in this component batch and its audit.
    WITH incoming AS MATERIALIZED (
      SELECT (value->>'escola_id')::uuid AS escola_id,
             (value->>'avaliacao_id')::uuid AS avaliacao_id,
             (value->>'matricula_id')::uuid AS matricula_id,
             (value->>'valor')::numeric AS valor,
             (value->>'is_isento')::boolean AS is_isento,
             value->'expected' AS expected
      FROM unnest(v_rows_to_upsert) AS value
    ), updated AS (
      UPDATE public.notas n SET valor = i.valor, is_isento = i.is_isento, updated_at = clock_timestamp()
      FROM incoming i
      WHERE i.expected <> 'null'::jsonb
        AND n.escola_id=i.escola_id AND n.avaliacao_id=i.avaliacao_id AND n.matricula_id=i.matricula_id
        AND n.id=(i.expected->>'id')::uuid
        AND n.updated_at IS NOT DISTINCT FROM (i.expected->>'updated_at')::timestamptz
        AND n.valor IS NOT DISTINCT FROM (i.expected->>'valor')::numeric
        AND n.is_isento IS NOT DISTINCT FROM (i.expected->>'is_isento')::boolean
      RETURNING n.id,n.matricula_id,n.valor,n.is_isento,n.updated_at,false AS inserted
    ), inserted AS (
      INSERT INTO public.notas(escola_id,avaliacao_id,matricula_id,valor,is_isento)
      SELECT escola_id,avaliacao_id,matricula_id,valor,is_isento FROM incoming WHERE expected = 'null'::jsonb
      ON CONFLICT (escola_id,matricula_id,avaliacao_id) DO NOTHING
      RETURNING id,matricula_id,valor,is_isento,updated_at,true AS inserted
    ), written AS (
      SELECT * FROM updated UNION ALL SELECT * FROM inserted
    )
    SELECT count(*) FILTER (WHERE inserted), count(*) FILTER (WHERE NOT inserted),
      COALESCE(jsonb_object_agg(matricula_id::text,jsonb_build_object('id',id,'updated_at',updated_at,'valor',valor,'is_isento',is_isento)), '{}'::jsonb)
    INTO v_inserted_count,v_updated_count,v_versions FROM written;
    IF v_inserted_count + v_updated_count <> cardinality(v_rows_to_upsert) THEN
      RAISE EXCEPTION 'GRADE_CONFLICT: outra sessão alterou a pauta; recarregue e reveja a nota.' USING ERRCODE = '40001';
    END IF;
  ELSE
  WITH upserted AS (
    INSERT INTO public.notas (
      escola_id,
      avaliacao_id,
      matricula_id,
      valor,
      is_isento
    )
    SELECT
      (value->>'escola_id')::uuid,
      (value->>'avaliacao_id')::uuid,
      (value->>'matricula_id')::uuid,
      (value->>'valor')::numeric,
      (value->>'is_isento')::boolean
    FROM unnest(v_rows_to_upsert) AS value
    ON CONFLICT (escola_id, matricula_id, avaliacao_id)
    DO UPDATE SET
      valor = EXCLUDED.valor,
      is_isento = EXCLUDED.is_isento,
      updated_at = now()
    RETURNING (xmax = 0) AS inserted
  )
  SELECT
    count(*) FILTER (WHERE inserted),
    count(*) FILTER (WHERE NOT inserted)
  INTO v_inserted_count, v_updated_count
  FROM upserted;
  END IF;

  INSERT INTO public.audit_logs (
    escola_id,
    actor_id,
    action,
    entity,
    entity_id,
    portal,
    details
  )
  VALUES (
    p_escola_id,
    v_actor_id,
    'NOTA_LANCADA_BATCH',
    'notas',
    v_avaliacao_id::text,
    v_portal,
    jsonb_build_object(
      'is_isento', COALESCE(p_is_isento, false),
      'trimestre', p_trimestre,
      'tipo', btrim(p_tipo_avaliacao),
      'turma_id', p_turma_id,
      'disciplina_id', p_disciplina_id,
      'session_id', v_turma.session_id,
      'escala', v_escala,
      'nota_max', v_nota_max,
      'inserted', v_inserted_count,
      'updated', v_updated_count
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'inserted', v_inserted_count,
    'updated', v_updated_count,
    'escala', v_escala,
    'nota_max', v_nota_max,
    'versions', v_versions
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.professor_iniciar_aula(
  p_escola_id uuid,
  p_aula_id uuid,
  p_professor_id uuid,
  p_inicio_real timestamptz DEFAULT now()
)
RETURNS public.aulas
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_aula public.aulas;
BEGIN
  SELECT a.* INTO v_aula
  FROM public.aulas a
  WHERE a.id = p_aula_id
    AND a.escola_id = p_escola_id
  FOR UPDATE;

  IF v_aula.id IS NULL THEN
    RAISE EXCEPTION 'Aula não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.professores p WHERE p.id=p_professor_id AND p.escola_id=p_escola_id AND p.profile_id=auth.uid()) THEN
    RAISE EXCEPTION 'Professor não autorizado para esta aula.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.turma_disciplinas td
    JOIN public.turmas t ON t.id=td.turma_id AND t.escola_id=td.escola_id
    JOIN public.anos_letivos al ON al.id=t.session_id AND al.escola_id=t.escola_id AND al.ano=t.ano_letivo
    WHERE td.id=v_aula.turma_disciplina_id AND td.escola_id=p_escola_id AND al.ativo IS TRUE
  ) THEN
    RAISE EXCEPTION 'ACADEMIC_YEAR_READ_ONLY: ano lectivo da aula não permite escrita.' USING ERRCODE = '40001';
  END IF;

  IF v_aula.professor_id IS DISTINCT FROM p_professor_id THEN
    RAISE EXCEPTION 'Professor não autorizado para esta aula.' USING ERRCODE = '42501';
  END IF;

  IF v_aula.status = 'em_andamento' THEN
    RETURN v_aula;
  END IF;

  IF v_aula.status NOT IN ('agendada', 'aguardando_confirmacao') THEN
    RAISE EXCEPTION 'Aula não pode ser iniciada no estado actual: %.', v_aula.status USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.aulas
  SET status = 'em_andamento',
      inicio_real = COALESCE(inicio_real, p_inicio_real),
      created_by = COALESCE(created_by, auth.uid())
  WHERE id = v_aula.id
  RETURNING * INTO v_aula;

  INSERT INTO public.aula_eventos (escola_id, aula_id, tipo, actor_id)
  VALUES (p_escola_id, v_aula.id, 'aula_iniciada', auth.uid());

  RETURN v_aula;
END;
$$;

CREATE OR REPLACE FUNCTION public.professor_finalizar_aula(
  p_escola_id uuid,
  p_aula_id uuid,
  p_professor_id uuid,
  p_resumo text DEFAULT NULL,
  p_observacoes text DEFAULT NULL,
  p_conteudo text DEFAULT NULL,
  p_fim_real timestamptz DEFAULT now()
)
RETURNS public.aulas
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_aula public.aulas;
BEGIN
  SELECT a.* INTO v_aula
  FROM public.aulas a
  WHERE a.id = p_aula_id
    AND a.escola_id = p_escola_id
  FOR UPDATE;

  IF v_aula.id IS NULL THEN
    RAISE EXCEPTION 'Aula não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.professores p WHERE p.id=p_professor_id AND p.escola_id=p_escola_id AND p.profile_id=auth.uid()) THEN
    RAISE EXCEPTION 'Professor não autorizado para esta aula.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.turma_disciplinas td
    JOIN public.turmas t ON t.id=td.turma_id AND t.escola_id=td.escola_id
    JOIN public.anos_letivos al ON al.id=t.session_id AND al.escola_id=t.escola_id AND al.ano=t.ano_letivo
    WHERE td.id=v_aula.turma_disciplina_id AND td.escola_id=p_escola_id AND al.ativo IS TRUE
  ) THEN
    RAISE EXCEPTION 'ACADEMIC_YEAR_READ_ONLY: ano lectivo da aula não permite escrita.' USING ERRCODE = '40001';
  END IF;

  IF v_aula.professor_id IS DISTINCT FROM p_professor_id THEN
    RAISE EXCEPTION 'Professor não autorizado para esta aula.' USING ERRCODE = '42501';
  END IF;

  IF v_aula.status = 'finalizada' THEN
    RETURN v_aula;
  END IF;

  IF v_aula.status <> 'em_andamento' THEN
    RAISE EXCEPTION 'Aula só pode ser finalizada quando está em andamento.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.aulas
  SET status = 'finalizada',
      fim_real = COALESCE(fim_real, p_fim_real),
      resumo = COALESCE(p_resumo, resumo),
      observacoes = COALESCE(p_observacoes, observacoes),
      conteudo = COALESCE(p_conteudo, conteudo),
      finalizado_por = auth.uid()
  WHERE id = v_aula.id
  RETURNING * INTO v_aula;

  INSERT INTO public.aula_eventos (escola_id, aula_id, tipo, actor_id, metadata)
  VALUES (
    p_escola_id,
    v_aula.id,
    'aula_finalizada',
    auth.uid(),
    jsonb_build_object('resumo', p_resumo, 'observacoes', p_observacoes)
  );

  RETURN v_aula;
END;
$$;

CREATE OR REPLACE FUNCTION public.professor_iniciar_aula_contexto(
  p_escola_id uuid,
  p_professor_id uuid,
  p_turma_id uuid,
  p_disciplina_id uuid,
  p_data date,
  p_slot_id uuid DEFAULT NULL,
  p_inicio_previsto time DEFAULT NULL,
  p_fim_previsto time DEFAULT NULL
)
RETURNS public.aulas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_turma public.turmas;
  v_matriz_id uuid;
  v_turma_disciplina public.turma_disciplinas;
  v_aula public.aulas;
BEGIN
  IF p_escola_id IS DISTINCT FROM public.current_tenant_escola_id() THEN
    RAISE EXCEPTION 'Escola inválida para o contexto actual.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.professores p WHERE p.id=p_professor_id AND p.escola_id=p_escola_id AND p.profile_id=auth.uid()) THEN
    RAISE EXCEPTION 'Professor não autorizado para esta aula.' USING ERRCODE = '42501';
  END IF;

  SELECT t.* INTO v_turma
  FROM public.turmas t
  WHERE t.id = p_turma_id AND t.escola_id = p_escola_id;
  IF v_turma.id IS NULL THEN
    RAISE EXCEPTION 'Turma não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.anos_letivos al WHERE al.id=v_turma.session_id AND al.escola_id=p_escola_id AND al.ano=v_turma.ano_letivo AND al.ativo IS TRUE FOR SHARE) THEN
    RAISE EXCEPTION 'ACADEMIC_YEAR_READ_ONLY: ano lectivo da turma não permite escrita.' USING ERRCODE = '40001';
  END IF;

  SELECT cm.id INTO v_matriz_id
  FROM public.curso_matriz cm
  WHERE cm.escola_id = p_escola_id
    AND cm.curso_id = v_turma.curso_id
    AND cm.classe_id = v_turma.classe_id
    AND cm.disciplina_id = p_disciplina_id
    AND cm.ativo = true
  LIMIT 1;
  IF v_matriz_id IS NULL THEN
    RAISE EXCEPTION 'Disciplina não pertence à turma.' USING ERRCODE = 'P0002';
  END IF;

  SELECT td.* INTO v_turma_disciplina
  FROM public.turma_disciplinas td
  WHERE td.escola_id = p_escola_id
    AND td.turma_id = p_turma_id
    AND td.curso_matriz_id = v_matriz_id
    AND (
      td.professor_id = p_professor_id
      OR EXISTS (
        SELECT 1 FROM public.turma_disciplinas_professores shared
        WHERE shared.escola_id = p_escola_id
          AND shared.turma_id = p_turma_id
          AND shared.disciplina_id = p_disciplina_id
          AND shared.professor_id = p_professor_id
      )
    )
  LIMIT 1;
  IF v_turma_disciplina.id IS NULL THEN
    RAISE EXCEPTION 'Professor não atribuído a esta disciplina.' USING ERRCODE = '42501';
  END IF;

  IF p_slot_id IS NOT NULL THEN
    SELECT a.* INTO v_aula FROM public.aulas a
    WHERE a.escola_id = p_escola_id AND a.turma_disciplina_id = v_turma_disciplina.id
      AND a.data = p_data AND a.slot_id = p_slot_id
    LIMIT 1;
  ELSE
    SELECT a.* INTO v_aula FROM public.aulas a
    WHERE a.escola_id = p_escola_id AND a.turma_disciplina_id = v_turma_disciplina.id
      AND a.data = p_data AND a.slot_id IS NULL
    LIMIT 1;
  END IF;

  IF v_aula.id IS NULL THEN
    INSERT INTO public.aulas (
      escola_id, turma_disciplina_id, data, slot_id, professor_id,
      inicio_previsto, fim_previsto, status, created_by
    ) VALUES (
      p_escola_id, v_turma_disciplina.id, p_data, p_slot_id, p_professor_id,
      p_inicio_previsto, p_fim_previsto, 'aguardando_confirmacao', auth.uid()
    ) RETURNING * INTO v_aula;
  END IF;

  RETURN public.professor_iniciar_aula(p_escola_id, v_aula.id, p_professor_id, now());
END;
$$;

REVOKE EXECUTE ON FUNCTION public.lancar_notas_batch(uuid,uuid,uuid,uuid,integer,text,jsonb,boolean) FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.professor_iniciar_aula(uuid,uuid,uuid,timestamptz) FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.professor_finalizar_aula(uuid,uuid,uuid,text,text,text,timestamptz) FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.professor_iniciar_aula_contexto(uuid,uuid,uuid,uuid,date,uuid,time,time) FROM PUBLIC,anon;
COMMIT;
