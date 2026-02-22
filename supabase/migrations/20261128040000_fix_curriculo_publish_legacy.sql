BEGIN;

CREATE OR REPLACE FUNCTION public.curriculo_publish_legacy(
  p_escola_id uuid,
  p_curso_id uuid,
  p_ano_letivo_id uuid,
  p_version integer,
  p_rebuild_turmas boolean DEFAULT true
) RETURNS TABLE (
  ok boolean,
  message text,
  published_curriculo_id uuid,
  previous_published_curriculo_id uuid,
  pendencias jsonb,
  pendencias_count integer
)
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_escola_id uuid := public.current_tenant_escola_id();
  v_target_id uuid;
  v_prev_id uuid;
  v_empty_curriculo boolean := false;
  v_overload boolean := false;
  v_core_short boolean := false;
  v_pendencias jsonb := '[]'::jsonb;
  v_pendencias_count integer := 0;
  v_rows int := 0;
BEGIN
  IF p_escola_id IS DISTINCT FROM v_escola_id THEN
    NULL;
  END IF;

  IF NOT public.user_has_role_in_school(v_escola_id, ARRAY['admin_escola']) THEN
    RAISE EXCEPTION 'permission denied: admin_escola required';
  END IF;

  IF p_version IS NULL OR p_version < 1 THEN
    RAISE EXCEPTION 'invalid version';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      v_escola_id::text || ':' || p_curso_id::text || ':' || p_ano_letivo_id::text,
      0
    )
  );

  SELECT cc.id INTO v_target_id
  FROM public.curso_curriculos cc
  WHERE cc.escola_id = v_escola_id
    AND cc.curso_id = p_curso_id
    AND cc.ano_letivo_id = p_ano_letivo_id
    AND cc.version = p_version
  LIMIT 1;

  IF v_target_id IS NULL THEN
    RETURN QUERY
    SELECT false, 'target curriculum version not found', NULL::uuid, NULL::uuid, '[]'::jsonb, 0;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.curso_curriculos
    WHERE id = v_target_id
      AND status = 'published'
  ) THEN
    RETURN QUERY
    SELECT true, 'already published (idempotent)', v_target_id, NULL::uuid, '[]'::jsonb, 0;
    RETURN;
  END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM public.curso_matriz cm
    WHERE cm.escola_id = v_escola_id
      AND cm.curso_curriculo_id = v_target_id
  ) INTO v_empty_curriculo;

  IF v_empty_curriculo THEN
    UPDATE public.curso_matriz cm
      SET curso_curriculo_id = v_target_id
     WHERE cm.escola_id = v_escola_id
       AND cm.curso_id = p_curso_id
       AND cm.classe_id IN (
         SELECT DISTINCT t.classe_id
         FROM public.turmas t
         WHERE t.escola_id = v_escola_id
           AND t.curso_id = p_curso_id
           AND t.ano_letivo_id = p_ano_letivo_id
       )
       AND cm.curso_curriculo_id IS DISTINCT FROM v_target_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows > 0 THEN
      v_empty_curriculo := false;
    END IF;
  END IF;

  IF v_empty_curriculo THEN
    RETURN QUERY
    SELECT false, 'curriculo sem disciplinas', NULL::uuid, NULL::uuid, '[]'::jsonb, 0;
    RETURN;
  END IF;

  WITH pendencias_base AS (
    SELECT
      cm.id AS curso_matriz_id,
      cm.disciplina_id,
      cm.classe_id,
      array_remove(array[
        CASE WHEN cm.carga_horaria_semanal IS NULL OR cm.carga_horaria_semanal <= 0 THEN 'carga_horaria_semanal' END,
        CASE WHEN cm.classificacao IS NULL THEN 'classificacao' END,
        CASE WHEN cm.periodos_ativos IS NULL OR array_length(cm.periodos_ativos, 1) = 0 THEN 'periodos_ativos' END,
        CASE WHEN cm.entra_no_horario IS NULL THEN 'entra_no_horario' END,
        CASE WHEN cm.avaliacao_mode IS NULL THEN 'avaliacao_mode' END,
        CASE WHEN cm.avaliacao_mode = 'custom' AND cm.avaliacao_modelo_id IS NULL THEN 'avaliacao_modelo_id' END,
        CASE WHEN cm.avaliacao_mode = 'inherit_disciplina' AND cm.avaliacao_disciplina_id IS NULL THEN 'avaliacao_disciplina_id' END,
        CASE WHEN cm.avaliacao_mode = 'custom'
              AND cm.avaliacao_modelo_id IS NOT NULL
              AND public.sum_component_pesos(ma.componentes) <> 100 THEN 'avaliacao_pesos' END
      ], NULL) AS pendencias_value
    FROM public.curso_matriz cm
    LEFT JOIN public.modelos_avaliacao ma
      ON ma.id = cm.avaliacao_modelo_id
    WHERE cm.escola_id = v_escola_id
      AND cm.curso_curriculo_id = v_target_id
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'curso_matriz_id', curso_matriz_id,
      'disciplina_id', disciplina_id,
      'classe_id', classe_id,
      'pendencias', pendencias_value
    )) FILTER (WHERE array_length(pendencias_value, 1) > 0), '[]'::jsonb),
    COALESCE(COUNT(*) FILTER (WHERE array_length(pendencias_value, 1) > 0), 0)
  INTO v_pendencias, v_pendencias_count
  FROM pendencias_base;

  IF v_pendencias_count > 0 THEN
    RETURN QUERY
    SELECT false, 'curriculo pendente: metadados obrigatorios ausentes', NULL::uuid, NULL::uuid, v_pendencias, v_pendencias_count;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.classes cl
      JOIN public.curso_matriz cm
        ON cm.classe_id = cl.id
     WHERE cm.escola_id = v_escola_id
       AND cm.curso_curriculo_id = v_target_id
       AND cl.carga_horaria_semanal IS NOT NULL
     GROUP BY cl.id, cl.carga_horaria_semanal
    HAVING SUM(COALESCE(cm.carga_horaria_semanal, 0)) > cl.carga_horaria_semanal
  ) INTO v_overload;

  IF v_overload THEN
    RETURN QUERY
    SELECT false, 'carga horaria acima do permitido na classe', NULL::uuid, NULL::uuid, '[]'::jsonb, 0;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.classes cl
      JOIN public.curso_matriz cm
        ON cm.classe_id = cl.id
     WHERE cm.escola_id = v_escola_id
       AND cm.curso_curriculo_id = v_target_id
       AND cl.min_disciplinas_core IS NOT NULL
     GROUP BY cl.id, cl.min_disciplinas_core
    HAVING COUNT(*) FILTER (WHERE cm.classificacao = 'core') < cl.min_disciplinas_core
  ) INTO v_core_short;

  IF v_core_short THEN
    RETURN QUERY
    SELECT false, 'disciplinas core abaixo do minimo', NULL::uuid, NULL::uuid, '[]'::jsonb, 0;
    RETURN;
  END IF;

  SELECT cc.id INTO v_prev_id
  FROM public.curso_curriculos cc
  WHERE cc.escola_id = v_escola_id
    AND cc.curso_id = p_curso_id
    AND cc.ano_letivo_id = p_ano_letivo_id
    AND cc.status = 'published'
  ORDER BY cc.version DESC
  LIMIT 1;

  IF v_prev_id IS NOT NULL THEN
    UPDATE public.curso_curriculos
      SET status = 'archived'
    WHERE id = v_prev_id;
  END IF;

  UPDATE public.curso_curriculos
    SET status = 'published'
  WHERE id = v_target_id;

  IF p_rebuild_turmas THEN
    PERFORM public.curriculo_rebuild_turma_disciplinas(v_escola_id, p_curso_id, p_ano_letivo_id);
  END IF;

  RETURN QUERY
  SELECT true,
         'published successfully',
         v_target_id,
         v_prev_id,
         '[]'::jsonb,
         0;
EXCEPTION
  WHEN unique_violation THEN
    SELECT cc.id INTO v_prev_id
    FROM public.curso_curriculos cc
    WHERE cc.escola_id = v_escola_id
      AND cc.curso_id = p_curso_id
      AND cc.ano_letivo_id = p_ano_letivo_id
      AND cc.status = 'published'
    ORDER BY cc.version DESC
    LIMIT 1;

    IF v_prev_id = v_target_id THEN
      RETURN QUERY SELECT true, 'published concurrently (idempotent)', v_target_id, NULL::uuid, '[]'::jsonb, 0;
    END IF;

    RETURN QUERY SELECT false, 'conflict: another version is published', v_prev_id, NULL::uuid, '[]'::jsonb, 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.curriculo_publish(
  p_escola_id uuid,
  p_curso_id uuid,
  p_ano_letivo_id uuid,
  p_version integer,
  p_rebuild_turmas boolean DEFAULT true,
  p_classe_id uuid DEFAULT NULL
) RETURNS TABLE (
  ok boolean,
  message text,
  published_curriculo_id uuid,
  previous_published_curriculo_id uuid,
  pendencias jsonb,
  pendencias_count integer
)
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_row record;
  v_ok boolean := true;
  v_message text := 'published successfully';
  v_last_published uuid := NULL;
  v_class_count integer := 0;
BEGIN
  IF p_classe_id IS NOT NULL THEN
    RETURN QUERY
      SELECT * FROM public.curriculo_publish_single(
        p_escola_id,
        p_curso_id,
        p_ano_letivo_id,
        p_version,
        p_rebuild_turmas,
        p_classe_id
      );
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_class_count
    FROM public.curso_curriculos cc
   WHERE cc.escola_id = p_escola_id
     AND cc.curso_id = p_curso_id
     AND cc.ano_letivo_id = p_ano_letivo_id
     AND cc.version = p_version
     AND cc.classe_id IS NOT NULL;

  IF v_class_count = 0 THEN
    RETURN QUERY
      SELECT * FROM public.curriculo_publish_legacy(
        p_escola_id,
        p_curso_id,
        p_ano_letivo_id,
        p_version,
        p_rebuild_turmas
      );
    RETURN;
  END IF;

  FOR v_row IN
    SELECT DISTINCT cc.classe_id
      FROM public.curso_curriculos cc
     WHERE cc.escola_id = p_escola_id
       AND cc.curso_id = p_curso_id
       AND cc.ano_letivo_id = p_ano_letivo_id
       AND cc.version = p_version
       AND cc.classe_id IS NOT NULL
  LOOP
    SELECT *
      INTO v_row
      FROM public.curriculo_publish_single(
        p_escola_id,
        p_curso_id,
        p_ano_letivo_id,
        p_version,
        p_rebuild_turmas,
        v_row.classe_id
      );

    IF NOT v_row.ok THEN
      v_ok := false;
      v_message := v_row.message;
    ELSE
      v_last_published := v_row.published_curriculo_id;
    END IF;
  END LOOP;

  RETURN QUERY
    SELECT v_ok, v_message, v_last_published, NULL::uuid, '[]'::jsonb, 0;
END;
$$;

COMMIT;
