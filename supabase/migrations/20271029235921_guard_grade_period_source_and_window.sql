-- PR #298: extend the already hardened canonical grade writer, preserving
-- its tenant isolation, teacher allocation, quantitative scale and audit contract.
-- Avoid reproducing the older function definition from a lagging environment.
-- Pilot-school calendar data is reconciled separately and only with approval.
BEGIN;

CREATE OR REPLACE FUNCTION public.lancar_notas_batch(
  p_escola_id uuid,
  p_turma_id uuid,
  p_disciplina_id uuid,
  p_turma_disciplina_id uuid,
  p_trimestre integer,
  p_tipo_avaliacao text,
  p_notas jsonb,
  p_is_isento boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth'
AS $$
DECLARE
  v_actor_id uuid := public.safe_auth_uid();
  v_claims jsonb := '{}'::jsonb;
  v_is_service_role boolean := false;
  v_is_staff boolean := false;
  v_professor_id uuid;
  v_turma record;
  v_turma_disciplina record;
  v_disciplina_matriz_id uuid;
  v_ano_ativo boolean := false;
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
    RAISE EXCEPTION 'ACADEMIC_YEAR_READ_ONLY: O ano letivo não está ativo para lançamento de notas.';
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
      AND m.ativo = true
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
$$;

REVOKE EXECUTE ON FUNCTION public.lancar_notas_batch(
  uuid, uuid, uuid, uuid, integer, text, jsonb, boolean
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.lancar_notas_batch(
  uuid, uuid, uuid, uuid, integer, text, jsonb, boolean
) TO authenticated, service_role;

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
     AND NOT public.can_bypass_pauta_lock(v_escola_id, v_turma_id, NEW.avaliacao_id, auth.uid()) THEN
    RAISE EXCEPTION 'O período para lançamento de notas está fechado (travado em %).', to_char(v_trava_notas_em, 'DD/MM/YYYY HH24:MI');
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_grade_period_source_and_window()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth'
AS $period_guard$
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
         m.ativo AS matricula_active
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
     OR v.matricula_active IS DISTINCT FROM TRUE THEN
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
     AND NOT public.can_bypass_pauta_lock(NEW.escola_id, v.turma_id, NEW.avaliacao_id, auth.uid()) THEN
    RAISE EXCEPTION 'ACADEMIC_PERIOD_LOCKED: Período concluído. Solicite reabertura à direção.';
  END IF;
  RETURN NEW;
END;
$period_guard$;

DROP TRIGGER IF EXISTS trg_guard_grade_period_source_and_window ON public.notas;
CREATE TRIGGER trg_guard_grade_period_source_and_window
BEFORE INSERT OR UPDATE ON public.notas
FOR EACH ROW EXECUTE FUNCTION public.guard_grade_period_source_and_window();

COMMIT;
