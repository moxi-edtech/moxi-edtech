-- Complete the school-scoped historical academic recovery for explicitly authorized staff.
-- Keep tenant isolation, a real enrollment, documented evidence and atomic audit.
BEGIN;

ALTER TABLE public.escola_users DROP CONSTRAINT escola_users_papel_check;
ALTER TABLE public.escola_users ADD CONSTRAINT escola_users_papel_check
 CHECK (papel = ANY (ARRAY['admin'::text,'staff_admin'::text,'financeiro'::text,'secretaria'::text,'aluno'::text,'professor'::text,'admin_escola'::text,'admin_financeiro'::text,'secretaria_financeiro'::text,'diretor'::text,'formacao_admin'::text,'formacao_secretaria'::text,'formacao_financeiro'::text,'formador'::text,'formando'::text,'admin_secretaria'::text,'admin_secretario'::text ]));

ALTER POLICY balcao_historic_recovery_school_read ON public.balcao_historic_recovery_requests
 USING (escola_id = public.current_tenant_escola_id()
 AND EXISTS (SELECT 1 FROM public.escola_users eu
 WHERE eu.escola_id = balcao_historic_recovery_requests.escola_id
 AND eu.user_id = (SELECT auth.uid())
 AND eu.papel IN ('secretaria','admin_secretaria','admin_secretario','admin_financeiro','admin','admin_escola','staff_admin','diretor','secretaria_financeiro')));

-- lancar_nota_historica_individual
CREATE OR REPLACE FUNCTION public.lancar_nota_historica_individual(p_escola_id uuid, p_matricula_id uuid, p_turma_disciplina_id uuid, p_trimestre integer, p_tipo_avaliacao text, p_valor numeric, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
DECLARE
 v_actor uuid := auth.uid();
 v_m record;
 v_disciplina_id uuid;
 v_active_year int;
 v_result jsonb;
BEGIN
 IF v_actor IS NULL OR public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id THEN
   RAISE EXCEPTION 'AUTH: escola fora do tenant ativo' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.escola_users eu
   WHERE eu.escola_id=p_escola_id AND eu.user_id=v_actor
     AND eu.papel IN ('secretaria','admin_secretaria','admin_secretario','admin_financeiro','admin','admin_escola','staff_admin','diretor')
 ) THEN
   RAISE EXCEPTION 'AUTH: operação histórica restrita à secretaria académica/direção'
     USING ERRCODE='42501';
 END IF;
 IF length(btrim(coalesce(p_motivo,''))) NOT BETWEEN 12 AND 500 THEN
   RAISE EXCEPTION 'DATA: motivo deve ter 12 a 500 caracteres' USING ERRCODE='22023';
 END IF;
 SELECT m.id,m.aluno_id,m.turma_id,m.session_id,m.ano_letivo,m.status,m.ativo,
        m.status_fecho_origem,y.ativo AS year_active
 INTO v_m
 FROM public.matriculas m JOIN public.anos_letivos y
   ON y.id=m.session_id AND y.escola_id=m.escola_id AND y.ano=m.ano_letivo
 WHERE m.id=p_matricula_id AND m.escola_id=p_escola_id
 FOR UPDATE OF m;
 IF NOT FOUND OR v_m.year_active=true
    OR v_m.status<>'pendente' OR v_m.ativo IS DISTINCT FROM false
    OR NOT (v_m.status_fecho_origem IS NULL OR v_m.status_fecho_origem='manual') THEN
   RAISE EXCEPTION 'HISTORIC_GRADE_SOURCE_INVALID: origem pendente do ano encerrado obrigatória'
     USING ERRCODE='23514';
 END IF;
 SELECT max(ano) INTO v_active_year FROM public.anos_letivos
 WHERE escola_id=p_escola_id AND ativo=true;
 IF v_active_year IS DISTINCT FROM v_m.ano_letivo+1 THEN
   RAISE EXCEPTION 'HISTORIC_GRADE_YEAR_INVALID: apenas o ano anterior ao ativo'
     USING ERRCODE='23514';
 END IF;
 IF EXISTS (SELECT 1 FROM public.historico_anos h
            WHERE h.escola_id=p_escola_id
              AND (h.matricula_id=v_m.id OR
                (h.aluno_id=v_m.aluno_id AND h.ano_letivo=v_m.ano_letivo)))
    OR EXISTS (SELECT 1 FROM public.historico_snapshot_locks l
               WHERE l.escola_id=p_escola_id AND l.matricula_id=v_m.id
                 AND l.ano_letivo_id=v_m.session_id AND l.status='fechado') THEN
   RAISE EXCEPTION 'HISTORIC_GRADE_LEGAL_LOCKED: histórico ou lock legal já publicado'
     USING ERRCODE='23514';
 END IF;
 SELECT cm.disciplina_id INTO v_disciplina_id
 FROM public.turma_disciplinas td
 JOIN public.curso_matriz cm ON cm.id=td.curso_matriz_id AND cm.escola_id=td.escola_id
 WHERE td.id=p_turma_disciplina_id AND td.escola_id=p_escola_id
   AND td.turma_id=v_m.turma_id;
 IF NOT FOUND OR v_disciplina_id IS NULL THEN
   RAISE EXCEPTION 'HISTORIC_GRADE_DISCIPLINE_MISMATCH: disciplina fora da turma'
     USING ERRCODE='23514';
 END IF;
 INSERT INTO public.balcao_grade_historic_nonce(escola_id,matricula_id,actor_id,motivo)
 VALUES(p_escola_id,v_m.id,v_actor,btrim(p_motivo));
 PERFORM pg_catalog.set_config('klasse.historic_grade_matricula_id',v_m.id::text,true);
 v_result := public.lancar_notas_batch(
   p_escola_id,v_m.turma_id,v_disciplina_id,p_turma_disciplina_id,
   p_trimestre,p_tipo_avaliacao,
   jsonb_build_array(jsonb_build_object('aluno_id',v_m.aluno_id,'valor',p_valor)),
   false);
 IF v_result->>'ok' IS DISTINCT FROM 'true' THEN
   RAISE EXCEPTION 'HISTORIC_GRADE_WRITE_FAILED: gravação não confirmada'
     USING ERRCODE='23514';
 END IF;
 DELETE FROM public.balcao_grade_historic_nonce
 WHERE escola_id=p_escola_id AND matricula_id=v_m.id AND actor_id=v_actor;
 PERFORM pg_catalog.set_config('klasse.historic_grade_matricula_id','',true);
 INSERT INTO public.audit_logs(escola_id,actor_id,action,entity,entity_id,portal,details)
 VALUES(p_escola_id,v_actor,'BALCAO_NOTA_HISTORICA_LANCADA',
   'matriculas',v_m.id::text,'secretaria',
   jsonb_build_object('motivo',btrim(p_motivo),'ano_origem',v_m.ano_letivo,
      'turma_id',v_m.turma_id,'turma_disciplina_id',p_turma_disciplina_id,
      'trimestre',p_trimestre,'tipo_avaliacao',p_tipo_avaliacao,
      'valor_novo',p_valor,'resultado',v_result));
 RETURN v_result || jsonb_build_object('historico',true,'matricula_id',v_m.id);
END;
$function$;


-- lancar_notas_batch
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

    v_rows_to_upsert := array_append(
      v_rows_to_upsert,
      jsonb_build_object(
        'escola_id', p_escola_id,
        'avaliacao_id', v_avaliacao_id,
        'matricula_id', v_matricula_id,
        'valor', v_valor,
        'is_isento', COALESCE(p_is_isento, false)
      )
    );
  END LOOP;

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
    'nota_max', v_nota_max
  );
END;
$function$;


-- finalizar_origem_academica
CREATE OR REPLACE FUNCTION public.finalizar_origem_academica(p_escola_id uuid, p_matricula_id uuid, p_resultado_final text, p_fonte text DEFAULT 'raa'::text, p_motivo text DEFAULT NULL::text, p_observacao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_actor_id uuid := public.safe_auth_uid();
  v_matricula public.matriculas%ROWTYPE;
  v_historico public.historico_anos%ROWTYPE;
  v_raa jsonb;
  v_decision text;
  v_ano_destino integer;
  v_resultado text := lower(btrim(coalesce(p_resultado_final,'')));
  v_fonte text := lower(btrim(coalesce(p_fonte,'')));
  v_status text;
  v_old_result text;
  v_cohort_exists boolean;
  v_motivo text;
BEGIN
  IF v_actor_id IS NULL OR public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id
    OR NOT public.user_has_role_in_school(p_escola_id, ARRAY['secretaria','admin_secretaria','admin_secretario','admin_financeiro','admin','admin_escola','staff_admin','diretor']::text[]) THEN
    RAISE EXCEPTION 'AUTH: escola ou utilizador sem autorização' USING ERRCODE='42501';
  END IF;

  IF v_resultado NOT IN ('aprovado','reprovado','concluido')
     OR v_fonte NOT IN ('raa','declaracao_administrativa_escola') THEN
    RAISE EXCEPTION 'ACADEMIC_EVIDENCE_INVALID: resultado ou fonte inválida' USING ERRCODE='23514';
  END IF;

  SELECT * INTO v_matricula FROM public.matriculas
  WHERE id=p_matricula_id AND escola_id=p_escola_id FOR UPDATE;
  IF NOT FOUND OR v_matricula.ano_letivo IS NULL OR v_matricula.turma_id IS NULL
      OR v_matricula.session_id IS NULL THEN
    RAISE EXCEPTION 'ACADEMIC_SOURCE_REQUIRED: origem, turma e ano letivo são obrigatórios' USING ERRCODE='23514';
  END IF;
  -- Enforce the same end-of-cycle rule for direct authenticated RPC calls.
  -- A promotion (aprovado/transitou) is not completion of an academic cycle.
  IF v_resultado = 'concluido' THEN
    DECLARE
      v_regime jsonb := public.resolve_regime_academico(v_matricula.turma_id);
      v_final boolean;
    BEGIN
      v_final := CASE
        WHEN lower(coalesce(v_regime->>'nivel_ensino','')) = 'eja'
          THEN (v_regime->>'modulo_numero' = '3' OR v_regime->>'ano_numero' = '2')
        ELSE v_regime->>'classe_num' IN ('6','9','12')
      END;
      IF v_final IS NOT TRUE THEN
        RAISE EXCEPTION 'ACADEMIC_CYCLE_NOT_FINAL: esta classe não conclui um ciclo de ensino'
          USING ERRCODE='23514';
      END IF;
    END;
  END IF;

  v_ano_destino := v_matricula.ano_letivo+1;
  v_motivo := coalesce(nullif(btrim(p_motivo),''),
    CASE WHEN v_fonte='raa' THEN 'Progressão académica confirmada pela decisão oficial do RAA' END);

  -- The cohort is *eligibility*, not a decision. Evidence and authorization
  -- must be explicitly recorded by the responsible staff member.
  IF v_fonte='declaracao_administrativa_escola' THEN
    -- Decision without grades is reserved to exact direction/admin roles.
    -- user_has_role_in_school expands aliases to financial roles: do not use
    -- it as authorization for historical grade/outcome overrides.
    IF NOT EXISTS (
      SELECT 1 FROM public.escola_users eu
      WHERE eu.escola_id=p_escola_id AND eu.user_id=v_actor_id
        AND eu.papel IN ('secretaria','admin_secretaria','admin_secretario','admin_financeiro','admin','admin_escola','staff_admin','diretor')
    ) THEN
      RAISE EXCEPTION 'ACADEMIC_DOCUMENT_AUTH_FORBIDDEN: só direção pode declarar resultado histórico'
        USING ERRCODE='42501';
    END IF;
    IF length(btrim(coalesce(p_motivo,''))) < 12
       OR length(btrim(coalesce(p_observacao,''))) < 8 THEN
      RAISE EXCEPTION 'ACADEMIC_DOCUMENT_REQUIRED: informe a referência da decisão escolar no motivo e na observação' USING ERRCODE='23514';
    END IF;
    SELECT EXISTS(
      SELECT 1 FROM public.academic_transition_cohort_members cm
      JOIN public.academic_transition_cohorts c ON c.id=cm.cohort_id
      WHERE cm.escola_id=p_escola_id AND cm.matricula_origem_id=p_matricula_id
        AND cm.aluno_id=v_matricula.aluno_id AND cm.status='elegivel'
        AND c.escola_id=p_escola_id AND c.ativo=true AND c.ano_origem=v_matricula.ano_letivo
        AND c.ano_destino=v_ano_destino AND c.modo='virada_assistida_sem_notas'
        AND (c.expira_em IS NULL OR c.expira_em>=CURRENT_DATE)
    ) INTO v_cohort_exists;
    IF NOT v_cohort_exists THEN
      RAISE EXCEPTION 'ASSISTED_TRANSITION_COHORT_REQUIRED: a decisão sem notas exige coorte assistida válida' USING ERRCODE='23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.notas n
      WHERE n.escola_id=p_escola_id AND n.matricula_id=p_matricula_id
    ) THEN
      RAISE EXCEPTION 'ACADEMIC_DOCUMENT_GRADES_PRESENT: não substituir notas lançadas por decisão documental'
        USING ERRCODE='23514';
    END IF;
  ELSE
    v_raa := public.resolve_raa_progression_for_matricula(p_escola_id,p_matricula_id);
    v_decision := lower(coalesce(v_raa->>'decision',''));
    IF (v_resultado IN ('aprovado','concluido') AND v_decision NOT IN ('transitou','aprovado','concluido','concluiu'))
       OR (v_resultado='reprovado' AND v_decision NOT IN ('retido','reprovado')) THEN
      RAISE EXCEPTION 'ACADEMIC_RAA_NOT_CONFIRMED: não há decisão de progressão compatível; resolva as pendências no RAA'
        USING ERRCODE='23514';
    END IF;
  END IF;

  SELECT * INTO v_historico FROM public.historico_anos
  WHERE escola_id=p_escola_id AND aluno_id=v_matricula.aluno_id
    AND ano_letivo=v_matricula.ano_letivo FOR UPDATE;
  IF FOUND THEN
    IF v_historico.matricula_id IS NOT NULL AND v_historico.matricula_id<>v_matricula.id
       OR coalesce(v_historico.snapshot_status,'aberto')<>'aberto' THEN
      RAISE EXCEPTION 'ACADEMIC_HISTORY_CONFLICT: histórico ligado a outra matrícula ou protegido legalmente'
        USING ERRCODE='23514';
    END IF;
    v_old_result := lower(btrim(coalesce(v_historico.resultado_final,'')));
    IF v_old_result <> '' AND v_old_result <> v_resultado THEN
      RAISE EXCEPTION 'ACADEMIC_RESULT_CONFLICT: decisão histórica divergente; requer retificação auditada'
        USING ERRCODE='23514';
    END IF;
  END IF;

  v_status := 'concluido'; -- resultado registado separadamente em historico_anos
  IF public.canonicalize_matricula_status_text(v_matricula.status) NOT IN ('pendente','ativo') THEN
    IF v_matricula.status=v_status
       AND v_historico.id IS NOT NULL AND v_historico.resultado_final=v_resultado THEN
      RETURN jsonb_build_object('ok',true,'reused',true,'historico_ano_id',v_historico.id,
        'matricula_id',p_matricula_id,'resultado_final',v_resultado,'status',v_status);
    END IF;
    RAISE EXCEPTION 'ACADEMIC_ALREADY_FINALIZED: a origem tem outro fecho; revisão auditada obrigatória'
      USING ERRCODE='23514';
  END IF;

  UPDATE public.matriculas SET
    status=v_status, ativo=false,
    motivo_fecho=v_motivo,
    status_fecho_origem=CASE WHEN v_fonte='declaracao_administrativa_escola' THEN 'override_admin' ELSE 'manual' END,
    data_fecho=coalesce(data_fecho,now()),
    updated_at=now(),
    updated_by=v_actor_id
  WHERE id=v_matricula.id AND escola_id=p_escola_id;

  INSERT INTO public.historico_anos (
    escola_id,aluno_id,ano_letivo,ano_letivo_id,turma_id,matricula_id,
    resultado_final,status_final,snapshot_status,data_fechamento
  ) VALUES (
    p_escola_id,v_matricula.aluno_id,v_matricula.ano_letivo,v_matricula.session_id,
    v_matricula.turma_id,v_matricula.id,v_resultado,v_resultado,'aberto',CURRENT_DATE
  )
  ON CONFLICT (escola_id,aluno_id,ano_letivo)
  DO UPDATE SET
    matricula_id=excluded.matricula_id,
    ano_letivo_id=excluded.ano_letivo_id,
    turma_id=excluded.turma_id,
    resultado_final=excluded.resultado_final,
    status_final=excluded.status_final,
    data_fechamento=excluded.data_fechamento
  RETURNING * INTO v_historico;

  INSERT INTO public.audit_logs (escola_id,actor_id,action,entity,entity_id,details,portal)
  VALUES (p_escola_id,v_actor_id,'MATRICULA_ORIGEM_RESULTADO_ACADEMICO_REGISTADO',
    'matriculas',p_matricula_id::text,
    jsonb_build_object('resultado_final',v_resultado,'fonte',v_fonte,
       'motivo',v_motivo,
       'observacao',NULLIF(btrim(p_observacao),''),
       'historico_ano_id',v_historico.id,'matricula_status',v_status,
       'snapshot_status','aberto','at',now()),
    'secretaria');

  RETURN jsonb_build_object('ok',true,'matricula_id',p_matricula_id,
    'historico_ano_id',v_historico.id,'resultado_final',v_resultado,
    'fonte',v_fonte,'status',v_status,'snapshot_status','aberto');
END;
$function$;


-- ratificar_resultado_historico_escola
CREATE OR REPLACE FUNCTION public.ratificar_resultado_historico_escola(p_escola_id uuid, p_matricula_id uuid, p_resultado_confirmado text, p_referencia_documental text, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_actor_id uuid := public.safe_auth_uid();
  v_m public.matriculas%ROWTYPE;
  v_h public.historico_anos%ROWTYPE;
  v_resultado text := lower(btrim(coalesce(p_resultado_confirmado,'')));
  v_ref text := btrim(coalesce(p_referencia_documental,''));
  v_motivo text := btrim(coalesce(p_motivo,''));
  v_has_cohort boolean;
  v_reused boolean;
  v_fixed boolean := false;
  v_authorized_role text;
BEGIN
  IF v_actor_id IS NULL OR public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id
     OR NOT public.user_has_role_in_school(p_escola_id,
       ARRAY['secretaria','admin_secretaria','admin_secretario','admin_financeiro','admin','admin_escola','staff_admin','diretor']::text[]) THEN
    RAISE EXCEPTION 'RATIFICATION_AUTH_FORBIDDEN: ratificação de históricos exige direção da escola'
      USING ERRCODE='42501';
  END IF;

  SELECT eu.papel INTO v_authorized_role
  FROM public.escola_users eu
  WHERE eu.escola_id=p_escola_id AND eu.user_id=v_actor_id
    AND eu.papel IN ('secretaria','admin_secretaria','admin_secretario','admin_financeiro','admin','admin_escola','staff_admin','diretor')
  LIMIT 1;
  IF v_authorized_role IS NULL THEN
    RAISE EXCEPTION 'RATIFICATION_AUTH_FORBIDDEN: só direção pode ratificar resultado histórico'
      USING ERRCODE='42501';
  END IF;

  IF length(v_ref)<8 OR length(v_motivo)<12 THEN
    RAISE EXCEPTION 'RATIFICATION_DOCUMENT_REQUIRED: informe referência documental e motivo da ratificação'
      USING ERRCODE='23514';
  END IF;

  SELECT * INTO v_m FROM public.matriculas
  WHERE escola_id=p_escola_id AND id=p_matricula_id FOR UPDATE;
  IF NOT FOUND OR v_m.ano_letivo IS NULL OR v_m.session_id IS NULL
     OR v_m.status IS DISTINCT FROM 'concluido' OR v_m.ativo THEN
    RAISE EXCEPTION 'RATIFICATION_SOURCE_INVALID: origem sem encerramento académico válido'
      USING ERRCODE='23514';
  END IF;

  SELECT * INTO v_h FROM public.historico_anos
  WHERE escola_id=p_escola_id AND aluno_id=v_m.aluno_id
    AND matricula_id=v_m.id AND ano_letivo=v_m.ano_letivo FOR UPDATE;
  IF NOT FOUND OR v_h.snapshot_status IS DISTINCT FROM 'aberto'
      OR v_resultado NOT IN ('aprovado','reprovado','concluido')
      OR v_h.resultado_final IS DISTINCT FROM v_resultado
      OR EXISTS(SELECT 1 FROM public.historico_snapshot_locks sl
                WHERE sl.matricula_id=v_m.id AND sl.escola_id=p_escola_id AND sl.status='fechado') THEN
    RAISE EXCEPTION 'RATIFICATION_RESULT_CONFLICT: histórico não corresponde à decisão ou já está fechado'
      USING ERRCODE='23514';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.academic_transition_cohort_members cm
    JOIN public.academic_transition_cohorts c ON c.id=cm.cohort_id
    WHERE cm.escola_id=p_escola_id AND cm.matricula_origem_id=v_m.id
      AND cm.aluno_id=v_m.aluno_id AND cm.status='elegivel'
      AND c.escola_id=p_escola_id AND c.ativo AND c.ano_origem=v_m.ano_letivo
      AND c.ano_destino=v_m.ano_letivo+1 AND c.modo='virada_assistida_sem_notas'
      AND (c.expira_em IS NULL OR c.expira_em>=CURRENT_DATE)
  ) INTO v_has_cohort;
  IF NOT v_has_cohort THEN
    RAISE EXCEPTION 'RATIFICATION_COHORT_REQUIRED: não existe coorte histórica autorizada'
      USING ERRCODE='23514';
  END IF;

  -- Historical import might have left its session link null.
  IF v_h.ano_letivo_id IS DISTINCT FROM v_m.session_id THEN
    IF v_h.ano_letivo_id IS NOT NULL THEN
      RAISE EXCEPTION 'RATIFICATION_YEAR_CONFLICT: histórico aponta para outro ano letivo'
        USING ERRCODE='23514';
    END IF;
    UPDATE public.historico_anos SET ano_letivo_id=v_m.session_id
    WHERE id=v_h.id AND escola_id=p_escola_id AND ano_letivo_id IS NULL;
  END IF;

  -- Uma matrícula concluída pode ter resultado académico reprovado.
  v_fixed := false;

  SELECT EXISTS(
    SELECT 1 FROM public.audit_logs a
    WHERE a.escola_id=p_escola_id AND a.entity_id=v_m.id::text
      AND a.actor_id=v_actor_id
      AND a.action='MATRICULA_ORIGEM_RESULTADO_ACADEMICO_REGISTADO'
      AND a.details->>'resultado_final'=v_resultado
      AND a.details->>'referencia_documental'=v_ref
      AND a.details->>'motivo'=v_motivo
      AND a.details->>'ratificacao'='true'
      AND a.details->>'papel_autorizado'=v_authorized_role
  ) INTO v_reused;

  IF NOT v_reused THEN
    INSERT INTO public.audit_logs (escola_id,actor_id,action,entity,entity_id,portal,details)
    VALUES (p_escola_id,v_actor_id,'MATRICULA_ORIGEM_RESULTADO_ACADEMICO_REGISTADO',
      'matriculas',v_m.id::text,'secretaria',
      jsonb_build_object('resultado_final',v_resultado,
        'fonte','declaracao_administrativa_escola',
        'motivo',v_motivo,
        'referencia_documental',v_ref,
        'ratificacao',true,
        'papel_autorizado',v_authorized_role,
        'status_corrigido',v_fixed,
        'historico_ano_id',v_h.id,
        'snapshot_status','aberto','at',now()));
  END IF;

  RETURN jsonb_build_object('ok',true,'reused',v_reused,'matricula_id',v_m.id,
    'historico_ano_id',v_h.id,'resultado_final',v_resultado,
    'status_corrigido',v_fixed,'snapshot_status','aberto',
    'proximo_passo','Confirmar documentação e fechar histórico pelo fluxo oficial');
END;
$function$;


-- historico_set_snapshot_state
CREATE OR REPLACE FUNCTION public.historico_set_snapshot_state(p_escola_id uuid, p_matricula_ids uuid[], p_ano_letivo_id uuid, p_novo_estado text, p_motivo text, p_run_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_id uuid := auth.uid();
  v_escola_id uuid := public.current_tenant_escola_id();
  v_has_permission boolean;
  v_row record;
  v_updated int := 0;
  v_new_status text := lower(trim(p_novo_estado));
  v_current_lock record;
BEGIN
  IF v_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  SELECT public.user_has_role_in_school(v_escola_id, ARRAY['admin', 'admin_escola', 'staff_admin', 'diretor', 'secretaria', 'admin_secretaria', 'admin_secretario', 'admin_financeiro'])
    INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada para alterar estado de snapshot histórico.';
  END IF;

  IF v_new_status NOT IN ('aberto', 'fechado', 'reaberto') THEN
    RAISE EXCEPTION 'LOGIC: estado inválido (%). Use aberto|fechado|reaberto.', p_novo_estado;
  END IF;

  IF v_new_status = 'reaberto' AND (p_motivo IS NULL OR btrim(p_motivo) = '') THEN
    RAISE EXCEPTION 'LOGIC: motivo é obrigatório para reabertura.';
  END IF;

  -- A verified documentary legal lock cannot be reopened or closed by
  -- financial aliases or ordinary secretariat staff through a direct RPC.
  IF EXISTS (
    SELECT 1 FROM public.matriculas m
    WHERE m.escola_id=p_escola_id
      AND m.id=ANY(p_matricula_ids)
      AND m.status_fecho_origem='override_admin'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.escola_users eu
    WHERE eu.escola_id=p_escola_id AND eu.user_id=v_actor_id
      AND eu.papel IN ('secretaria','admin_secretaria','admin_secretario','admin_financeiro','admin','admin_escola','staff_admin','diretor')
  ) THEN
    RAISE EXCEPTION 'HISTORICAL_SNAPSHOT_AUTH_FORBIDDEN: decisão histórica exige direção'
      USING ERRCODE='42501';
  END IF;

  -- Even a director cannot call the generic snapshot RPC to close an
  -- unratified override_admin decision. Enforce this in PostgreSQL, not only
  -- in the Balcão API. Fail closed if grades were recorded meanwhile.
  IF v_new_status='fechado' AND EXISTS (
    SELECT 1 FROM public.matriculas m
    JOIN public.historico_anos h
      ON h.escola_id=m.escola_id AND h.matricula_id=m.id
      AND h.aluno_id=m.aluno_id AND h.ano_letivo=m.ano_letivo
      AND h.ano_letivo_id=p_ano_letivo_id
    WHERE m.escola_id=p_escola_id AND m.id=ANY(p_matricula_ids)
      AND m.status_fecho_origem='override_admin'
      AND (
        h.resultado_final NOT IN ('aprovado','reprovado','concluido')
        OR EXISTS (
          SELECT 1 FROM public.notas n
          WHERE n.escola_id=m.escola_id AND n.matricula_id=m.id
        )
        OR NOT EXISTS (
          SELECT 1 FROM public.audit_logs a
          WHERE a.escola_id=m.escola_id AND a.entity_id=m.id::text
            AND a.actor_id IS NOT NULL
            AND a.action='MATRICULA_ORIGEM_RESULTADO_ACADEMICO_REGISTADO'
            AND a.details->>'historico_ano_id'=h.id::text
            AND a.details->>'resultado_final'=h.resultado_final
            AND a.details->>'fonte'='declaracao_administrativa_escola'
            AND a.details->>'ratificacao'='true'
            AND a.details->>'papel_autorizado'
              IN ('secretaria','admin_secretaria','admin_secretario','admin_financeiro','admin','admin_escola','staff_admin','diretor')
            AND length(btrim(coalesce(a.details->>'referencia_documental','')))>=8
            AND length(btrim(coalesce(a.details->>'motivo','')))>=12
        )
      )
  ) THEN
    RAISE EXCEPTION 'HISTORICAL_RATIFICATION_REQUIRED: fecho exige decisão documental ratificada e sem notas divergentes'
      USING ERRCODE='23514';
  END IF;

  FOR v_row IN
    SELECT m.id AS matricula_id, m.aluno_id
    FROM public.matriculas m
    WHERE m.escola_id = v_escola_id
      AND m.id = ANY(p_matricula_ids)
  LOOP
    SELECT * INTO v_current_lock
    FROM public.historico_snapshot_locks hsl
    WHERE hsl.escola_id = v_escola_id
      AND hsl.ano_letivo_id = p_ano_letivo_id
      AND hsl.matricula_id = v_row.matricula_id
    FOR UPDATE;

    INSERT INTO public.historico_snapshot_locks (
      escola_id,
      ano_letivo_id,
      matricula_id,
      status,
      lock_run_id,
      lock_job_id,
      lock_step,
      lock_reason,
      locked_at,
      reopened_at,
      reopened_by,
      reopened_reason,
      allow_reopen
    )
    VALUES (
      v_escola_id,
      p_ano_letivo_id,
      v_row.matricula_id,
      v_new_status,
      p_run_id,
      p_run_id,
      CASE WHEN v_new_status = 'fechado' THEN 'GENERATING_HISTORY' ELSE NULL END,
      CASE WHEN v_new_status = 'fechado' THEN p_motivo ELSE NULL END,
      CASE WHEN v_new_status = 'fechado' THEN now() ELSE v_current_lock.locked_at END,
      CASE WHEN v_new_status = 'reaberto' THEN now() ELSE NULL END,
      CASE WHEN v_new_status = 'reaberto' THEN v_actor_id ELSE NULL END,
      CASE WHEN v_new_status = 'reaberto' THEN p_motivo ELSE NULL END,
      CASE WHEN v_new_status = 'reaberto' THEN true ELSE false END
    )
    ON CONFLICT (escola_id, ano_letivo_id, matricula_id)
    DO UPDATE SET
      status = EXCLUDED.status,
      lock_run_id = EXCLUDED.lock_run_id,
      lock_job_id = EXCLUDED.lock_job_id,
      lock_step = EXCLUDED.lock_step,
      lock_reason = COALESCE(EXCLUDED.lock_reason, public.historico_snapshot_locks.lock_reason),
      locked_at = COALESCE(EXCLUDED.locked_at, public.historico_snapshot_locks.locked_at),
      reopened_at = EXCLUDED.reopened_at,
      reopened_by = EXCLUDED.reopened_by,
      reopened_reason = EXCLUDED.reopened_reason,
      allow_reopen = EXCLUDED.allow_reopen,
      updated_at = now();

    UPDATE public.historico_anos ha
      SET snapshot_status = v_new_status,
          snapshot_lock_run_id = p_run_id,
          snapshot_locked_at = CASE WHEN v_new_status = 'fechado' THEN now() ELSE ha.snapshot_locked_at END,
          snapshot_reopened_at = CASE WHEN v_new_status = 'reaberto' THEN now() ELSE ha.snapshot_reopened_at END,
          snapshot_reopened_by = CASE WHEN v_new_status = 'reaberto' THEN v_actor_id ELSE ha.snapshot_reopened_by END,
          snapshot_reopen_reason = CASE WHEN v_new_status = 'reaberto' THEN p_motivo ELSE ha.snapshot_reopen_reason END
    WHERE ha.escola_id = v_escola_id
      AND ha.ano_letivo_id = p_ano_letivo_id
      AND ha.matricula_id = v_row.matricula_id;

    INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
    VALUES (
      v_escola_id,
      v_actor_id,
      CASE WHEN v_new_status = 'reaberto' THEN 'HISTORICO_SNAPSHOT_REABERTO' ELSE 'HISTORICO_SNAPSHOT_ESTADO_ALTERADO' END,
      'historico_snapshot_locks',
      v_row.matricula_id::text,
      'secretaria',
      jsonb_build_object(
        'ano_letivo_id', p_ano_letivo_id,
        'matricula_id', v_row.matricula_id,
        'novo_estado', v_new_status,
        'run_id', p_run_id,
        'motivo', p_motivo
      )
    );

    v_updated := v_updated + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'updated', v_updated, 'novo_estado', v_new_status);
END;
$function$;


-- solicitar_regularizacao_historica_balcao
CREATE OR REPLACE FUNCTION public.solicitar_regularizacao_historica_balcao(p_escola_id uuid, p_matricula_id uuid, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_aluno uuid;
  v_request_id uuid;
  v_event_id uuid;
  v_created boolean := false;
BEGIN
  IF v_actor IS NULL OR public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola fora do tenant ativo' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.escola_users eu WHERE eu.escola_id=p_escola_id
      AND eu.user_id=v_actor
      AND eu.papel IN ('secretaria','admin_secretaria','admin','admin_escola',
                       'staff_admin','diretor','admin_financeiro','admin_secretario','secretaria_financeiro')
  ) THEN
    RAISE EXCEPTION 'AUTH: perfil sem acesso ao atendimento académico' USING ERRCODE='42501';
  END IF;
  IF length(btrim(coalesce(p_motivo,''))) NOT BETWEEN 12 AND 500 THEN
    RAISE EXCEPTION 'DATA: indique o motivo da solicitação (12-500 caracteres)' USING ERRCODE='22023';
  END IF;

  SELECT m.aluno_id INTO v_aluno
  FROM public.matriculas m
  JOIN public.anos_letivos y ON y.id=m.session_id AND y.escola_id=m.escola_id
    AND y.ano=m.ano_letivo AND y.ativo=false
  WHERE m.id=p_matricula_id AND m.escola_id=p_escola_id
    AND m.ativo=false
    AND (
      (m.status='pendente' AND coalesce(m.status_fecho_origem,'manual')='manual')
      OR (m.status='concluido' AND m.status_fecho_origem='override_admin'
          AND EXISTS (
            SELECT 1 FROM public.historico_anos h
            WHERE h.escola_id=p_escola_id AND h.matricula_id=m.id
              AND h.snapshot_status='aberto'
          ))
    )
    AND EXISTS (
      SELECT 1 FROM public.anos_letivos target
      WHERE target.escola_id=p_escola_id AND target.ativo=true
        AND target.ano=m.ano_letivo+1
    )
  FOR SHARE OF m;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACADEMIC_SOURCE_INVALID: origem não elegível para pedido de regularização'
      USING ERRCODE='23514';
  END IF;

  INSERT INTO public.balcao_historic_recovery_requests
    (escola_id,matricula_id,aluno_id,solicitante_id,motivo)
  VALUES (p_escola_id,p_matricula_id,v_aluno,v_actor,btrim(p_motivo))
  ON CONFLICT (escola_id,matricula_id) WHERE status='pendente' DO NOTHING
  RETURNING id INTO v_request_id;

  IF v_request_id IS NOT NULL THEN
    v_created := true;
    -- Use the existing school notification channel. The generic event type
    -- does not broadcast to unrelated roles (trg_despachar_evento ignores it).
    INSERT INTO public.eventos(
      escola_id,tipo,payload,actor_id,actor_role,entidade_tipo,entidade_id)
    VALUES (
      p_escola_id,'sistema.funcionalidade'::public.evento_tipo,
      jsonb_build_object('subtipo','pedido_regularizacao_historica',
                         'pedido_id',v_request_id,'matricula_id',p_matricula_id,
                         'aluno_id',v_aluno),
      v_actor,
      (SELECT eu.papel FROM public.escola_users eu
       WHERE eu.escola_id=p_escola_id AND eu.user_id=v_actor LIMIT 1),
      'matriculas',p_matricula_id
    )
    RETURNING id INTO v_event_id;
    INSERT INTO public.notificacoes (
      escola_id,evento_id,destinatario_id,titulo,corpo,prioridade,
      action_label,action_url
    )
    SELECT p_escola_id,v_event_id,eu.user_id,
      'Regularização académica pendente',
      'Há um pedido de regularização de origem deste aluno: ' || left(btrim(p_motivo),280),
      'aviso'::public.notificacao_prioridade,
      'Abrir ficha no Balcão',
      '/secretaria/balcao?alunoId=' || v_aluno::text
    FROM public.escola_users eu
    WHERE eu.escola_id=p_escola_id AND eu.user_id<>v_actor
      AND eu.papel IN ('secretaria','admin_secretaria','admin_secretario','admin_financeiro','admin','admin_escola','staff_admin','diretor')
    ON CONFLICT (evento_id,destinatario_id) DO NOTHING;

    INSERT INTO public.audit_logs(escola_id,actor_id,action,entity,entity_id,portal,details)
    VALUES (p_escola_id,v_actor,'BALCAO_REGULARIZACAO_ACADEMICA_SOLICITADA',
      'matriculas',p_matricula_id::text,'secretaria',
      jsonb_build_object('pedido_id',v_request_id,'aluno_id',v_aluno,
                         'motivo',btrim(p_motivo),'evento_id',v_event_id));
  ELSE
    SELECT id INTO v_request_id FROM public.balcao_historic_recovery_requests
    WHERE escola_id=p_escola_id AND matricula_id=p_matricula_id
      AND status='pendente';
  END IF;
  RETURN jsonb_build_object('ok',true,'pedido_id',v_request_id,
                            'criado',v_created);
END;
$function$;


-- The RAA reader must recognize a signed legal closure from the same exact staff set.
CREATE OR REPLACE FUNCTION public.resolve_raa_progression_for_matricula(p_escola_id uuid, p_matricula_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_legal jsonb;
  v_authorized record;
  v_historic record;
BEGIN
  -- The final legal snapshot is the authority only for a documented
  -- school decision in a valid, approved 2025->2026 historical cohort.
  -- This branch never changes grades or automatically decides an outcome.
  IF public.safe_auth_uid() IS NOT NULL
     AND public.current_tenant_escola_id() IS NOT DISTINCT FROM p_escola_id
  THEN
    SELECT m.id AS matricula_id, m.turma_id, h.id AS historico_id,
           h.resultado_final AS resultado
      INTO v_historic
    FROM public.matriculas m
    JOIN public.historico_anos h
      ON h.escola_id=m.escola_id AND h.aluno_id=m.aluno_id
      AND h.matricula_id=m.id AND h.ano_letivo=m.ano_letivo
      AND h.ano_letivo_id=m.session_id
    WHERE m.escola_id=p_escola_id AND m.id=p_matricula_id
      AND m.status='concluido' AND m.ativo=false
      AND m.status_fecho_origem='override_admin'
      AND h.snapshot_status='fechado'
      AND h.resultado_final IN ('aprovado','reprovado','concluido')
      AND EXISTS (
        SELECT 1 FROM public.historico_snapshot_locks sl
        WHERE sl.escola_id=p_escola_id AND sl.matricula_id=m.id
          AND sl.ano_letivo_id=m.session_id AND sl.status='fechado'
          AND sl.historico_ano_id=h.id
      )
      AND EXISTS (
        SELECT 1 FROM public.academic_transition_cohort_members cm
        JOIN public.academic_transition_cohorts c
          ON c.id=cm.cohort_id AND c.escola_id=cm.escola_id
        WHERE cm.escola_id=p_escola_id
          AND cm.matricula_origem_id=m.id
          AND cm.aluno_id=m.aluno_id AND cm.status='elegivel'
          AND c.ativo AND c.modo='virada_assistida_sem_notas'
          AND c.ano_origem=m.ano_letivo
          AND c.ano_destino=m.ano_letivo+1
          AND (c.expira_em IS NULL OR c.expira_em >= (now() AT TIME ZONE 'Africa/Luanda')::date)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.notas n
        WHERE n.escola_id=p_escola_id AND n.matricula_id=m.id
      )
      AND EXISTS (
        SELECT 1 FROM public.audit_logs a
        WHERE a.escola_id=p_escola_id
          AND a.entity_id=m.id::text
          AND a.actor_id IS NOT NULL
          AND a.action='MATRICULA_ORIGEM_RESULTADO_ACADEMICO_REGISTADO'
          AND a.details->>'fonte'='declaracao_administrativa_escola'
          AND a.details->>'ratificacao'='true'
          AND a.details->>'papel_autorizado' IN ('secretaria','admin_secretaria','admin_secretario','admin_financeiro','admin','admin_escola','staff_admin','diretor')
          AND a.details->>'historico_ano_id'=h.id::text
          AND a.details->>'resultado_final'=h.resultado_final
          AND length(btrim(coalesce(a.details->>'referencia_documental','')))>=8
          AND length(btrim(coalesce(a.details->>'motivo','')))>=12
      )
    LIMIT 1;
    IF v_historic.matricula_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'decision', CASE v_historic.resultado
          WHEN 'aprovado' THEN 'transitou'
          WHEN 'reprovado' THEN 'retido'
          ELSE 'concluiu' END,
        'destino', CASE v_historic.resultado
          WHEN 'aprovado' THEN 'proxima_etapa'
          WHEN 'reprovado' THEN 'mesma_etapa'
          ELSE 'conclusao' END,
        'motivo','historico_documental_ratificado',
        'fonte_decisao','historico_documental_ratificado',
        'historico_ano_id',v_historic.historico_id,
        'disciplina_ids_pendentes','[]'::jsonb,
        'regime',public.resolve_regime_academico(v_historic.turma_id),
        'etapa_destino',null,
        'efetivacao_matricula_bloqueada',false
      );
    END IF;
  END IF;

  SELECT id, pendencias, motivo INTO v_authorized
  FROM public.promocoes_com_pendencias
  WHERE escola_id = p_escola_id
    AND matricula_origem_id = p_matricula_id
    AND status = 'autorizada'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_authorized.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'decision', 'transitou',
      'destino', 'proxima_etapa',
      'motivo', 'promovido_com_pendencias',
      'autorizacao_id', v_authorized.id,
      'disciplina_ids_pendentes', v_authorized.pendencias,
      'proximo_passo', 'Lançar e fechar as notas pendentes da matrícula de origem.'
    );
  END IF;

  v_legal := public.resolve_raa_decreto_for_matricula(p_escola_id, p_matricula_id);
  IF v_legal IS NOT NULL THEN
    RETURN v_legal;
  END IF;

  BEGIN
    RETURN public.resolve_raa_progression_for_matricula_generic(p_escola_id, p_matricula_id);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%RAA_PROGRESSION_POLICY_NOT_CONFIGURED%' THEN
      RETURN jsonb_build_object(
        'decision', 'pendente', 'destino', 'aguardar_dados', 'motivo', 'dados_pendentes',
        'disciplina_ids_pendentes', '[]'::jsonb,
        'proximo_passo', 'Configurar a política de progressão e concluir as notas finais da matrícula.'
      );
    END IF;
    RAISE;
  END;
END;
$function$;


COMMIT;
