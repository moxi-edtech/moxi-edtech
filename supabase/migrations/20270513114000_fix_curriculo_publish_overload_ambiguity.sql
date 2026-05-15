BEGIN;

DROP FUNCTION IF EXISTS public.curriculo_publish(uuid, uuid, uuid, integer, boolean, uuid);

CREATE FUNCTION public.curriculo_publish(
  p_escola_id uuid,
  p_curso_id uuid,
  p_ano_letivo_id uuid,
  p_version integer,
  p_rebuild_turmas boolean,
  p_classe_id uuid
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
AS $function$
DECLARE
  v_row record;
  v_ok boolean := true;
  v_message text := 'published successfully';
  v_last_published uuid := NULL;
  v_class_count integer := 0;
BEGIN
  IF p_classe_id IS NOT NULL THEN
    SELECT *
      INTO v_row
      FROM public.curriculo_publish_single(
        p_escola_id,
        p_curso_id,
        p_ano_letivo_id,
        p_version,
        p_rebuild_turmas,
        p_classe_id
      );

    IF v_row.ok THEN
      PERFORM public.curriculo_create_avaliacoes_for_turmas(
        p_escola_id,
        p_curso_id,
        p_ano_letivo_id,
        p_classe_id
      );
    END IF;

    RETURN QUERY
      SELECT v_row.ok,
             v_row.message,
             v_row.published_curriculo_id,
             v_row.previous_published_curriculo_id,
             v_row.pendencias,
             v_row.pendencias_count;
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
      INTO v_row
      FROM public.curriculo_publish_legacy(
        p_escola_id,
        p_curso_id,
        p_ano_letivo_id,
        p_version,
        p_rebuild_turmas
      );

    IF v_row.ok THEN
      PERFORM public.curriculo_create_avaliacoes_for_turmas(
        p_escola_id,
        p_curso_id,
        p_ano_letivo_id,
        NULL
      );
    END IF;

    RETURN QUERY
      SELECT v_row.ok,
             v_row.message,
             v_row.published_curriculo_id,
             v_row.previous_published_curriculo_id,
             v_row.pendencias,
             v_row.pendencias_count;
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

  IF v_ok THEN
    PERFORM public.curriculo_create_avaliacoes_for_turmas(
      p_escola_id,
      p_curso_id,
      p_ano_letivo_id,
      NULL
    );
  END IF;

  RETURN QUERY
    SELECT v_ok, v_message, v_last_published, NULL::uuid, '[]'::jsonb, 0;
END;
$function$;

COMMIT;
