-- PR #298: guard the authoritative school-year / trimester at the database boundary.
-- Never apply by bypassing RLS or relaxing existing academic closing policies.
-- The official 2026/2027 pilot-calendar reconciliation is in a separate,
-- explicitly reviewed ops script (no automatic school data mutation here).
BEGIN;

CREATE OR REPLACE FUNCTION public.lancar_notas_batch(p_escola_id uuid, p_turma_id uuid, p_disciplina_id uuid, p_turma_disciplina_id uuid, p_trimestre integer, p_tipo_avaliacao text, p_notas jsonb, p_is_isento boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
DECLARE
  v_actor_id uuid := auth.uid();
  v_professor_id uuid;
  v_turma record;
  v_turma_disciplina record;
  v_avaliacao_id uuid;
  v_is_professor_assigned boolean := false;
  v_ano_letivo int;
  v_is_admin boolean := false;
  v_portal text := 'professor';
  v_actor_papel text := null;
  v_actor_role text := null;
  v_ano_letivo_id uuid;
  v_periodo_letivo_id uuid;
  nota_record jsonb;
  v_matricula_id uuid;
  v_rows_to_upsert jsonb[] := '{}';
  v_inserted_count bigint;
  v_updated_count bigint;
BEGIN
  SELECT eu.papel INTO v_actor_papel
  FROM public.escola_users eu
  WHERE eu.user_id = v_actor_id
    AND eu.escola_id = p_escola_id
  LIMIT 1;

  SELECT pr.role INTO v_actor_role
  FROM public.profiles pr
  WHERE pr.user_id = v_actor_id
  ORDER BY pr.created_at DESC
  LIMIT 1;

  SELECT p.id INTO v_professor_id
  FROM public.professores p
  WHERE p.profile_id = v_actor_id
    AND p.escola_id = p_escola_id;

  IF v_professor_id IS NULL THEN
    SELECT true INTO v_is_admin
    FROM public.escola_users eu
    WHERE eu.user_id = v_actor_id
      AND eu.escola_id = p_escola_id
      AND eu.papel IN ('admin_escola', 'admin', 'staff_admin', 'secretaria')
    LIMIT 1;

    IF NOT v_is_admin THEN
      SELECT true INTO v_is_admin
      FROM public.profiles pr
      WHERE pr.user_id = v_actor_id
        AND pr.role IN ('admin', 'super_admin', 'global_admin')
      LIMIT 1;
    END IF;

    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'AUTH: Professor não encontrado para este usuário.';
    END IF;
  END IF;

  IF v_is_admin THEN
    v_portal := 'secretaria';
  END IF;

  SELECT t.id, t.escola_id, t.curso_id, t.classe_id, t.ano_letivo, t.session_id
  INTO v_turma
  FROM public.turmas t
  WHERE t.id = p_turma_id AND t.escola_id = p_escola_id;
  IF v_turma.id IS NULL THEN RAISE EXCEPTION 'DATA: Turma não encontrada.'; END IF;
  v_ano_letivo := v_turma.ano_letivo;

  SELECT td.id, td.professor_id, td.curso_matriz_id, td.turma_id, td.avaliacao_disciplina_id
  INTO v_turma_disciplina
  FROM public.turma_disciplinas td
  WHERE td.id = p_turma_disciplina_id AND td.escola_id = p_escola_id;
  IF v_turma_disciplina.id IS NULL THEN RAISE EXCEPTION 'DATA: Disciplina da turma não encontrada.'; END IF;
  IF v_turma_disciplina.turma_id IS DISTINCT FROM p_turma_id THEN
    RAISE EXCEPTION 'DATA: Disciplina não pertence à turma.';
  END IF;
  IF v_turma_disciplina.avaliacao_disciplina_id IS NOT NULL
     AND v_turma_disciplina.avaliacao_disciplina_id IS DISTINCT FROM p_disciplina_id THEN
    RAISE EXCEPTION 'DATA: Disciplina não corresponde ao vínculo da turma.';
  END IF;

  -- Never move an enrolment into the school's currently active year.
  -- The requested class's session is the only valid source of truth.
  SELECT al.id INTO v_ano_letivo_id
  FROM public.anos_letivos al
  WHERE al.escola_id = p_escola_id
    AND al.id = v_turma.session_id
    AND al.ano = v_ano_letivo
  LIMIT 1;

  IF v_ano_letivo_id IS NULL THEN
    RAISE EXCEPTION 'DATA: Ano letivo não encontrado.';
  END IF;

  SELECT pl.id INTO v_periodo_letivo_id
  FROM public.periodos_letivos pl
  WHERE pl.escola_id = p_escola_id
    AND pl.ano_letivo_id = v_ano_letivo_id
    AND pl.tipo = 'TRIMESTRE'
    AND pl.numero = p_trimestre
    AND pl.offering_id IS NULL
  LIMIT 1;

  IF v_periodo_letivo_id IS NULL THEN
    RAISE EXCEPTION 'DATA: Período letivo não encontrado.';
  END IF;

  IF p_notas IS NULL OR jsonb_typeof(p_notas) <> 'array' THEN
    RAISE EXCEPTION 'DATA: Notas devem ser uma lista.';
  END IF;
  IF jsonb_array_length(p_notas) = 0 OR jsonb_array_length(p_notas) > 50 THEN
    RAISE EXCEPTION 'DATA: Lote de notas inválido.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_notas) AS r(value)
    GROUP BY r.value->>'aluno_id' HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'DATA: Aluno duplicado no lote de notas.'; END IF;

  IF NOT v_is_admin THEN
    v_is_professor_assigned := v_turma_disciplina.professor_id = v_professor_id;
    IF NOT v_is_professor_assigned THEN
      SELECT true INTO v_is_professor_assigned
      FROM public.turma_disciplinas_professores
      WHERE escola_id = p_escola_id
        AND turma_id = p_turma_id
        AND disciplina_id = p_disciplina_id
        AND professor_id = v_professor_id;
      IF NOT v_is_professor_assigned THEN
        RAISE EXCEPTION 'AUTH: Professor não atribuído a esta disciplina/turma.';
      END IF;
    END IF;
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
    v_ano_letivo,
    p_trimestre,
    p_tipo_avaliacao,
    p_tipo_avaliacao,
    1,
    20
  )
  ON CONFLICT (escola_id, turma_disciplina_id, ano_letivo, trimestre, tipo)
  DO UPDATE SET nome = EXCLUDED.nome
  RETURNING id INTO v_avaliacao_id;

  FOR nota_record IN SELECT * FROM jsonb_array_elements(p_notas) LOOP
    IF (nota_record->>'valor') IS NULL
       OR (nota_record->>'valor')::numeric < 0
       OR (nota_record->>'valor')::numeric > 20 THEN
      RAISE EXCEPTION 'DATA: Nota fora da escala de 0 a 20.';
    END IF;
    v_matricula_id := NULL;
    SELECT m.id INTO v_matricula_id
    FROM public.matriculas m
    WHERE m.escola_id = p_escola_id
      AND m.turma_id = p_turma_id
      AND m.aluno_id = (nota_record->>'aluno_id')::uuid
      AND m.ano_letivo = v_ano_letivo
      AND m.session_id = v_ano_letivo_id
      AND m.ativo IS TRUE;

    IF v_matricula_id IS NULL THEN
      RAISE EXCEPTION 'DATA: Matrícula ativa não encontrada na turma e ano de origem.';
    ELSE
      v_rows_to_upsert := array_append(v_rows_to_upsert, jsonb_build_object(
        'escola_id', p_escola_id,
        'avaliacao_id', v_avaliacao_id,
        'matricula_id', v_matricula_id,
        'valor', (nota_record->>'valor')::numeric,
        'is_isento', COALESCE(p_is_isento, false)
      ));
    END IF;
  END LOOP;

  WITH upserted AS (
    INSERT INTO public.notas (escola_id, avaliacao_id, matricula_id, valor, is_isento)
    SELECT 
      (value->>'escola_id')::uuid,
      (value->>'avaliacao_id')::uuid,
      (value->>'matricula_id')::uuid,
      (value->>'valor')::numeric,
      (value->>'is_isento')::boolean
    FROM unnest(v_rows_to_upsert) as value
    ON CONFLICT (escola_id, matricula_id, avaliacao_id) DO UPDATE 
      SET valor = EXCLUDED.valor,
          is_isento = EXCLUDED.is_isento,
          updated_at = now()
    RETURNING xmax
  )
  SELECT
    count(*) FILTER (WHERE xmax = 0),
    count(*) FILTER (WHERE xmax::text::int > 0)
  INTO v_inserted_count, v_updated_count
  FROM upserted;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    p_escola_id,
    v_actor_id,
    'NOTA_LANCADA_BATCH',
    'notas',
    v_avaliacao_id::text,
    v_portal,
    jsonb_build_object(
      'is_isento', p_is_isento,
      'trimestre', p_trimestre,
      'tipo', p_tipo_avaliacao,
      'turma_id', p_turma_id,
      'disciplina_id', p_disciplina_id,
      'inserted', v_inserted_count,
      'updated', v_updated_count,
      'actor_role', v_actor_role,
      'actor_papel', v_actor_papel,
      'is_admin', v_is_admin
    )
  );

  RETURN jsonb_build_object('ok', true, 'inserted', v_inserted_count, 'updated', v_updated_count);
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
         td.turma_id, t.session_id AS turma_year_id, t.ano_letivo AS turma_year,
         m.turma_id AS matricula_turma_id, m.session_id AS matricula_year_id, m.ano_letivo AS matricula_year,
         m.ativo AS matricula_active
    INTO v
    FROM public.avaliacoes a
    JOIN public.turma_disciplinas td ON td.id = a.turma_disciplina_id
    JOIN public.turmas t ON t.id = td.turma_id
    JOIN public.periodos_letivos pl ON pl.id = a.periodo_letivo_id
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
