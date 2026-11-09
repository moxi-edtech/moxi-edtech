-- RETROACTIVE GRADE CORRECTION: one enrollment, one authenticated author,
-- one atomic write. School/year/trimestre are not globally reopened.
BEGIN;
CREATE TABLE public.balcao_grade_historic_nonce (
 escola_id uuid NOT NULL, matricula_id uuid NOT NULL, actor_id uuid NOT NULL,
 motivo text NOT NULL CHECK (length(btrim(motivo)) BETWEEN 12 AND 500),
 expires_at timestamptz NOT NULL DEFAULT now() + interval '5 minutes',
 PRIMARY KEY (escola_id,matricula_id,actor_id)
);
ALTER TABLE public.balcao_grade_historic_nonce ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.balcao_grade_historic_nonce FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.can_write_historical_grade(
 p_escola_id uuid,p_matricula_id uuid,p_actor_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth'
AS $func$
 SELECT p_actor_id IS NOT NULL AND p_actor_id=auth.uid()
   AND public.current_tenant_escola_id()=p_escola_id
   AND EXISTS (
     SELECT 1 FROM public.balcao_grade_historic_nonce x
     JOIN public.matriculas m ON m.escola_id=x.escola_id AND m.id=x.matricula_id
     JOIN public.anos_letivos y ON y.id=m.session_id AND y.escola_id=m.escola_id
     WHERE x.escola_id=p_escola_id AND x.matricula_id=p_matricula_id
       AND x.actor_id=p_actor_id AND x.expires_at>now()
       AND m.status='pendente' AND m.ativo=false
       AND (m.status_fecho_origem IS NULL OR m.status_fecho_origem='manual')
       AND y.ativo=false AND y.ano=m.ano_letivo
       AND NOT EXISTS (
         SELECT 1 FROM public.historico_anos h
         WHERE h.escola_id=m.escola_id
           AND (h.matricula_id=m.id OR
             (h.aluno_id=m.aluno_id AND h.ano_letivo=m.ano_letivo))
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.historico_snapshot_locks l
         WHERE l.escola_id=m.escola_id AND l.matricula_id=m.id
           AND l.ano_letivo_id=m.session_id AND l.status='fechado'
       )
   );
$func$;
REVOKE ALL ON FUNCTION public.can_write_historical_grade(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_write_historical_grade(uuid,uuid,uuid) TO authenticated;

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
        AND eu.papel IN ('secretaria','admin_secretaria','admin','admin_escola','staff_admin','diretor')
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

-- guard_grade_period_source_and_window

CREATE OR REPLACE FUNCTION public.guard_grade_period_source_and_window()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
DECLARE
  v record;
  v_today date := (now() AT TIME ZONE 'Africa/Luanda')::date;
BEGIN
  SELECT a.escola_id, a.ano_letivo, a.trimestre,
         pl.id AS period_id, pl.numero AS period_num, pl.ano_letivo_id AS period_year_id,
         pl.data_inicio AS begins, pl.data_fim AS ends, pl.trava_notas_em AS lock_at,
         pl.source_template_id AS source_template_id,
         pl.source_item_id AS source_item_id,
         ct.is_oficial AS template_official, ct.estado::text AS template_status,
         ct.ano_base AS template_year,
         ci.numero AS item_number, ci.tipo::text AS item_type,
         ci.data_inicio AS item_start, ci.data_fim AS item_end,
         td.turma_id, t.session_id AS turma_year_id, t.ano_letivo AS turma_year,
         m.turma_id AS matricula_turma_id, m.session_id AS matricula_year_id, m.ano_letivo AS matricula_year,
         m.ativo AS matricula_active, m.status AS matricula_status,
         m.status_fecho_origem AS matricula_origin_closed
    INTO v
    FROM public.avaliacoes a
    JOIN public.turma_disciplinas td ON td.id = a.turma_disciplina_id
    JOIN public.turmas t ON t.id = td.turma_id
    JOIN public.periodos_letivos pl ON pl.id = a.periodo_letivo_id
    LEFT JOIN public.calendario_templates ct ON ct.id = pl.source_template_id
    LEFT JOIN public.calendario_template_items ci ON ci.id = pl.source_item_id
         AND ci.template_id = ct.id
    JOIN public.matriculas m ON m.id = NEW.matricula_id
   WHERE a.id = NEW.avaliacao_id
     AND a.escola_id = NEW.escola_id
     AND td.escola_id = NEW.escola_id
     AND t.escola_id = NEW.escola_id
     AND pl.escola_id = NEW.escola_id
     AND m.escola_id = NEW.escola_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: Contexto de avaliação não encontrado.';
  END IF;
  IF v.period_year_id IS DISTINCT FROM v.turma_year_id
     OR v.matricula_year_id IS DISTINCT FROM v.turma_year_id
     OR v.matricula_turma_id IS DISTINCT FROM v.turma_id
     OR v.ano_letivo IS DISTINCT FROM v.turma_year
     OR v.matricula_year IS DISTINCT FROM v.turma_year
     OR v.trimestre IS DISTINCT FROM v.period_num
     OR NOT (
       v.matricula_active IS TRUE
       OR public.can_write_historical_grade(NEW.escola_id,NEW.matricula_id,auth.uid())
       OR (
         v.matricula_status = 'pendente'
         AND v.matricula_active IS FALSE
         AND v.matricula_origin_closed IS NULL
         AND auth.uid() IS NOT NULL
         AND public.current_tenant_escola_id() = NEW.escola_id
         AND EXISTS (
           SELECT 1 FROM public.escola_users eu
           WHERE eu.escola_id = NEW.escola_id AND eu.user_id = auth.uid()
             AND eu.papel IN ('secretaria','admin_secretaria','admin',
                              'admin_escola','staff_admin','diretor')
         )
         AND NOT EXISTS (
           SELECT 1 FROM public.historico_anos h
           WHERE h.escola_id = NEW.escola_id AND h.matricula_id = NEW.matricula_id
             AND h.resultado_final IS NOT NULL
         )
       )
     ) THEN
    RAISE EXCEPTION 'DATA: Avaliação, matrícula, turma, ano ou trimestre incompatíveis.';
  END IF;
  IF v.turma_year = 2026 AND (
       v.source_template_id IS NULL OR v.source_item_id IS NULL
       OR v.template_official IS DISTINCT FROM TRUE
       OR v.template_status IS DISTINCT FROM 'PUBLICADO'
       OR v.template_year IS DISTINCT FROM v.turma_year
       OR v.item_type IS DISTINCT FROM 'PERIODO_LETIVO'
       OR v.item_number IS DISTINCT FROM v.trimestre
       OR v.item_start IS DISTINCT FROM v.begins
       OR v.item_end IS DISTINCT FROM v.ends
     ) THEN
    RAISE EXCEPTION 'OFFICIAL_CALENDAR_NOT_RECONCILED: O trimestre não corresponde ao calendário oficial publicado.';
  END IF;
  IF v.begins IS NULL OR v.ends IS NULL OR v.begins > v.ends THEN
    RAISE EXCEPTION 'DATA: Datas do trimestre não configuradas.';
  END IF;
  IF v_today < v.begins THEN
    RAISE EXCEPTION 'DATA: O trimestre ainda não começou.';
  END IF;
  IF (v_today > v.ends OR (v.lock_at IS NOT NULL AND now() >= v.lock_at))
     AND NOT public.can_bypass_pauta_lock(NEW.escola_id, v.turma_id, NEW.avaliacao_id, auth.uid())
     AND NOT public.can_write_historical_grade(NEW.escola_id,NEW.matricula_id,auth.uid()) THEN
    RAISE EXCEPTION 'ACADEMIC_PERIOD_LOCKED: Período concluído. Solicite reabertura à direção.';
  END IF;
  RETURN NEW;
END;
$function$;



CREATE OR REPLACE FUNCTION public.block_notas_after_lock_date()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_trava_notas_em timestamptz;
  v_escola_id uuid;
  v_turma_id uuid;
BEGIN
  -- Encontra a data de trava a partir da avaliação associada à nota
  SELECT pl.trava_notas_em, a.escola_id, td.turma_id
  INTO v_trava_notas_em, v_escola_id, v_turma_id
  FROM public.avaliacoes a
  JOIN public.periodos_letivos pl ON a.periodo_letivo_id = pl.id
  JOIN public.turma_disciplinas td ON td.id = a.turma_disciplina_id
  WHERE a.id = NEW.avaliacao_id;

  -- Se a data de trava existe e já passou, rejeita a operação
  IF v_trava_notas_em IS NOT NULL AND v_trava_notas_em <= now()
     AND NOT public.can_bypass_pauta_lock(v_escola_id, v_turma_id, NEW.avaliacao_id, auth.uid())
     AND NOT public.can_write_historical_grade(NEW.escola_id,NEW.matricula_id,auth.uid()) THEN
    RAISE EXCEPTION 'O período para lançamento de notas está fechado (travado em %).', to_char(v_trava_notas_em, 'DD/MM/YYYY HH24:MI');
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_notas_when_turma_fechada()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth', 'extensions'
AS $function$
DECLARE
  v_turma_id uuid;
  v_status text;
  v_periodo_id uuid;
  v_trava timestamptz;
  v_user_id uuid := auth.uid();
  v_escola_id uuid;
BEGIN
  SELECT td.turma_id, a.escola_id INTO v_turma_id, v_escola_id
  FROM public.avaliacoes a
  JOIN public.turma_disciplinas td ON td.id = a.turma_disciplina_id
  WHERE a.id = NEW.avaliacao_id;

  IF v_turma_id IS NULL THEN
    RAISE EXCEPTION 'Turma não encontrada para validação de notas.';
  END IF;

  -- A nonce is valid only for the single enrollment in this transaction.
  IF public.can_write_historical_grade(NEW.escola_id,NEW.matricula_id,v_user_id) THEN
    RETURN NEW;
  END IF;
  -- 1. Verificar se existe uma exceção ativa para este utilizador/turma/trimestre
  IF public.can_bypass_pauta_lock(v_escola_id, v_turma_id, NEW.avaliacao_id, v_user_id) THEN
    RETURN NEW; -- Bypassa todos os outros bloqueios
  END IF;

  -- 2. Bloqueio por status da Turma
  SELECT status_fecho INTO v_status FROM public.turmas WHERE id = v_turma_id;
  IF v_status IS DISTINCT FROM 'ABERTO' THEN
    RAISE EXCEPTION 'Turma fechada para lançamento de notas. Solicite reabertura ao Diretor.';
  END IF;

  -- 3. Bloqueio por trava de calendário (periodos_letivos)
  SELECT a.periodo_letivo_id INTO v_periodo_id
  FROM public.avaliacoes a
  WHERE a.id = NEW.avaliacao_id;

  IF v_periodo_id IS NOT NULL THEN
    SELECT trava_notas_em INTO v_trava
    FROM public.periodos_letivos
    WHERE id = v_periodo_id;

    IF v_trava IS NOT NULL AND v_trava <= now() THEN
      RAISE EXCEPTION 'Período letivo fechado pelo calendário oficial. Solicite reabertura ao Diretor.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_avaliacoes_when_turma_fechada()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_turma_id uuid;
  v_status text;
  v_trava timestamptz;
BEGIN
  SELECT turma_id INTO v_turma_id
  FROM public.turma_disciplinas
  WHERE id = NEW.turma_disciplina_id;

  IF v_turma_id IS NULL THEN
    RAISE EXCEPTION 'Turma não encontrada para avaliação.';
  END IF;

  IF nullif(current_setting('klasse.historic_grade_matricula_id',true),'') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.matriculas m
      JOIN public.turma_disciplinas td ON td.turma_id=m.turma_id
      WHERE m.id=nullif(current_setting('klasse.historic_grade_matricula_id',true),'')::uuid
        AND m.escola_id=NEW.escola_id AND td.id=NEW.turma_disciplina_id
        AND public.can_write_historical_grade(m.escola_id,m.id,auth.uid())
    ) THEN
      RETURN NEW;
  END IF;
  SELECT status_fecho INTO v_status FROM public.turmas WHERE id = v_turma_id;
  IF v_status IS DISTINCT FROM 'ABERTO' THEN
    RAISE EXCEPTION 'Turma fechada para lançamento de avaliações.';
  END IF;

  IF NEW.periodo_letivo_id IS NOT NULL THEN
    SELECT trava_notas_em INTO v_trava
    FROM public.periodos_letivos
    WHERE id = NEW.periodo_letivo_id;

    IF v_trava IS NOT NULL AND v_trava <= now() THEN
      RAISE EXCEPTION 'Período letivo fechado para lançamento de avaliações.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.lancar_nota_historica_individual(
 p_escola_id uuid,p_matricula_id uuid,p_turma_disciplina_id uuid,
 p_trimestre integer,p_tipo_avaliacao text,p_valor numeric,p_motivo text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth'
AS $func$
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
     AND eu.papel IN ('secretaria','admin_secretaria','diretor','admin','admin_escola','staff_admin')
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
$func$;
REVOKE ALL ON FUNCTION public.lancar_nota_historica_individual(uuid,uuid,uuid,integer,text,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.lancar_nota_historica_individual(uuid,uuid,uuid,integer,text,numeric,text) TO authenticated;
COMMIT;
