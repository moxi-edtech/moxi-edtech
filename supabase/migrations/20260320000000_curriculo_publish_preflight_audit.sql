BEGIN;

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
  v_result record;
  v_ok boolean := true;
  v_message text := 'published successfully';
  v_last_published uuid := NULL;
  v_class_count integer := 0;
  v_missing_classes jsonb := '[]'::jsonb;
  v_missing_classes_count integer := 0;
  v_failed_details jsonb := '[]'::jsonb;
  v_failed_classes uuid[] := ARRAY[]::uuid[];
  v_actor_id uuid := auth.uid();
  v_action text;
BEGIN
  IF p_classe_id IS NOT NULL THEN
    SELECT *
      INTO v_result
      FROM public.curriculo_publish_single(
        p_escola_id,
        p_curso_id,
        p_ano_letivo_id,
        p_version,
        p_rebuild_turmas,
        p_classe_id
      );

    IF v_result.ok THEN
      PERFORM public.curriculo_create_avaliacoes_for_turmas(
        p_escola_id,
        p_curso_id,
        p_ano_letivo_id,
        p_classe_id
      );
    END IF;

    IF v_result.ok AND v_result.message = 'already published (idempotent)' THEN
      v_action := 'CURRICULUM_PUBLISH_IDEMPOTENT';
    ELSIF v_result.ok THEN
      v_action := 'CURRICULUM_PUBLISH';
    ELSE
      v_action := 'CURRICULUM_PUBLISH_FAILED';
    END IF;

    INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
    VALUES (
      p_escola_id,
      v_actor_id,
      v_action,
      'curso_curriculos',
      CASE WHEN v_result.published_curriculo_id IS NOT NULL THEN v_result.published_curriculo_id::text ELSE NULL END,
      'admin',
      jsonb_build_object(
        'curso_id', p_curso_id,
        'ano_letivo_id', p_ano_letivo_id,
        'version', p_version,
        'classe_id', p_classe_id,
        'message', v_result.message,
        'pendencias', v_result.pendencias,
        'pendencias_count', v_result.pendencias_count
      )
    );

    RETURN QUERY
      SELECT v_result.ok,
             v_result.message,
             v_result.published_curriculo_id,
             v_result.previous_published_curriculo_id,
             v_result.pendencias,
             v_result.pendencias_count;
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
    SELECT *
      INTO v_result
      FROM public.curriculo_publish_legacy(
        p_escola_id,
        p_curso_id,
        p_ano_letivo_id,
        p_version,
        p_rebuild_turmas
      );

    IF v_result.ok THEN
      PERFORM public.curriculo_create_avaliacoes_for_turmas(
        p_escola_id,
        p_curso_id,
        p_ano_letivo_id,
        NULL
      );
    END IF;

    IF v_result.ok AND v_result.message = 'already published (idempotent)' THEN
      v_action := 'CURRICULUM_PUBLISH_IDEMPOTENT';
    ELSIF v_result.ok THEN
      v_action := 'CURRICULUM_PUBLISH';
    ELSE
      v_action := 'CURRICULUM_PUBLISH_FAILED';
    END IF;

    INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
    VALUES (
      p_escola_id,
      v_actor_id,
      v_action,
      'curso_curriculos',
      CASE WHEN v_result.published_curriculo_id IS NOT NULL THEN v_result.published_curriculo_id::text ELSE NULL END,
      'admin',
      jsonb_build_object(
        'curso_id', p_curso_id,
        'ano_letivo_id', p_ano_letivo_id,
        'version', p_version,
        'message', v_result.message
      )
    );

    RETURN QUERY
      SELECT v_result.ok,
             v_result.message,
             v_result.published_curriculo_id,
             v_result.previous_published_curriculo_id,
             v_result.pendencias,
             v_result.pendencias_count;
    RETURN;
  END IF;

  WITH expected AS (
    SELECT cl.id, cl.nome
      FROM public.classes cl
     WHERE cl.escola_id = p_escola_id
       AND cl.curso_id = p_curso_id
  ),
  configured AS (
    SELECT DISTINCT cc.classe_id
      FROM public.curso_curriculos cc
     WHERE cc.escola_id = p_escola_id
       AND cc.curso_id = p_curso_id
       AND cc.ano_letivo_id = p_ano_letivo_id
       AND cc.version = p_version
       AND cc.classe_id IS NOT NULL
  ),
  missing AS (
    SELECT expected.id, expected.nome
      FROM expected
      LEFT JOIN configured
        ON configured.classe_id = expected.id
     WHERE configured.classe_id IS NULL
  )
  SELECT
    COALESCE(
      jsonb_agg(jsonb_build_object('classe_id', missing.id, 'classe_nome', missing.nome)),
      '[]'::jsonb
    ),
    COALESCE(count(*), 0)
    INTO v_missing_classes, v_missing_classes_count
  FROM missing;

  IF v_missing_classes_count > 0 THEN
    INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
    VALUES (
      p_escola_id,
      v_actor_id,
      'CURRICULUM_PUBLISH_FAILED',
      'curso_curriculos',
      NULL,
      'admin',
      jsonb_build_object(
        'curso_id', p_curso_id,
        'ano_letivo_id', p_ano_letivo_id,
        'version', p_version,
        'message', 'curriculo incompleto: classes sem versao publicada',
        'missing_classes', v_missing_classes,
        'missing_classes_count', v_missing_classes_count
      )
    );

    RETURN QUERY
      SELECT false,
             'curriculo incompleto: classes sem versao publicada',
             NULL::uuid,
             NULL::uuid,
             v_missing_classes,
             v_missing_classes_count;
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
      INTO v_result
      FROM public.curriculo_publish_single(
        p_escola_id,
        p_curso_id,
        p_ano_letivo_id,
        p_version,
        p_rebuild_turmas,
        v_row.classe_id
      );

    IF NOT v_result.ok THEN
      v_ok := false;
      v_message := v_result.message;
      v_failed_classes := array_append(v_failed_classes, v_row.classe_id);
      v_failed_details := v_failed_details || jsonb_build_array(
        jsonb_build_object(
          'classe_id', v_row.classe_id,
          'message', v_result.message,
          'pendencias', v_result.pendencias,
          'pendencias_count', v_result.pendencias_count
        )
      );
    ELSE
      v_last_published := v_result.published_curriculo_id;
    END IF;
  END LOOP;

  IF v_ok THEN
    PERFORM public.curriculo_create_avaliacoes_for_turmas(
      p_escola_id,
      p_curso_id,
      p_ano_letivo_id,
      NULL
    );
  END IF;

  IF v_ok THEN
    v_action := 'CURRICULUM_PUBLISH';
  ELSE
    v_action := 'CURRICULUM_PUBLISH_FAILED';
  END IF;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    p_escola_id,
    v_actor_id,
    v_action,
    'curso_curriculos',
    CASE WHEN v_last_published IS NOT NULL THEN v_last_published::text ELSE NULL END,
    'admin',
    jsonb_build_object(
      'curso_id', p_curso_id,
      'ano_letivo_id', p_ano_letivo_id,
      'version', p_version,
      'classes_count', v_class_count,
      'failed_classes', v_failed_classes,
      'failures', v_failed_details,
      'message', v_message
    )
  );

  RETURN QUERY
    SELECT v_ok,
           v_message,
           v_last_published,
           NULL::uuid,
           CASE WHEN v_ok THEN '[]'::jsonb ELSE v_failed_details END,
           CASE WHEN v_ok THEN 0 ELSE COALESCE(jsonb_array_length(v_failed_details), 0) END;
END;
$$;

COMMIT;
