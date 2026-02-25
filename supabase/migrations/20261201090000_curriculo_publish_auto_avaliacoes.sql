BEGIN;

CREATE OR REPLACE FUNCTION public.curriculo_create_avaliacoes_for_turmas(
  p_escola_id uuid,
  p_curso_id uuid,
  p_ano_letivo_id uuid,
  p_classe_id uuid DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_escola_id uuid := public.current_tenant_escola_id();
  v_rows integer := 0;
BEGIN
  IF p_escola_id IS DISTINCT FROM v_escola_id THEN
    NULL;
  END IF;

  IF NOT public.user_has_role_in_school(v_escola_id, ARRAY['admin_escola', 'secretaria', 'admin']) THEN
    RAISE EXCEPTION 'permission denied: admin_escola required';
  END IF;

  WITH periodos AS (
    SELECT id, numero
      FROM public.periodos_letivos
     WHERE escola_id = v_escola_id
       AND ano_letivo_id = p_ano_letivo_id
       AND tipo = 'TRIMESTRE'
  ),
  base AS (
    SELECT td.id AS turma_disciplina_id,
           t.ano_letivo,
           unnest(coalesce(td.periodos_ativos, ARRAY[1,2,3])) AS trimestre
      FROM public.turma_disciplinas td
      JOIN public.turmas t
        ON t.id = td.turma_id
     WHERE td.escola_id = v_escola_id
       AND t.escola_id = v_escola_id
       AND t.curso_id = p_curso_id
       AND t.ano_letivo_id = p_ano_letivo_id
       AND (p_classe_id IS NULL OR t.classe_id = p_classe_id)
  ),
  tipos AS (
    SELECT unnest(ARRAY['MAC', 'NPP', 'NPT']) AS tipo
  )
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
  SELECT
    v_escola_id,
    base.turma_disciplina_id,
    periodos.id,
    base.ano_letivo,
    base.trimestre,
    tipos.tipo,
    tipos.tipo,
    1,
    20
  FROM base
  JOIN periodos
    ON periodos.numero = base.trimestre
  CROSS JOIN tipos
  ON CONFLICT (escola_id, turma_disciplina_id, ano_letivo, trimestre, tipo) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
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
$$;

CREATE OR REPLACE FUNCTION public.gerar_turmas_from_curriculo(
  p_escola_id uuid,
  p_curso_id uuid,
  p_ano_letivo integer,
  p_generation_params jsonb,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano_letivo_id uuid;
  v_published_curriculo_id uuid;
  v_turma_data jsonb;
  v_turma_id uuid;
  v_new_turmas_count integer := 0;
  v_new_turma_disciplinas_count integer := 0;
  v_actor_id uuid := auth.uid();
  v_turno text;
  v_turma_letter text;
  v_turma_nome_final text;
  v_quantidade int;
  v_capacidade_maxima int := (p_generation_params->>'capacidadeMaxima')::int;
  v_curso_matriz_item record;
  v_modelo_avaliacao_id uuid;
  v_existing_audit bigint;
  v_existing_details jsonb;
  v_missing_classes text[];
  letters text[] := ARRAY['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];
BEGIN
  IF p_escola_id IS DISTINCT FROM public.current_tenant_escola_id() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT public.user_has_role_in_school(p_escola_id, ARRAY['admin_escola', 'secretaria', 'admin']) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id, details
    INTO v_existing_audit, v_existing_details
    FROM public.audit_logs
   WHERE escola_id = p_escola_id
     AND action = 'TURMAS_GERADAS_FROM_CURRICULO'
     AND details->>'idempotency_key' = p_idempotency_key
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_existing_audit IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'turmas_criadas', COALESCE((v_existing_details->>'turmas_count')::int, 0),
      'turma_disciplinas_criadas', COALESCE((v_existing_details->>'turma_disciplinas_count')::int, 0),
      'audit_log_id', v_existing_audit
    );
  END IF;

  SELECT id
    INTO v_ano_letivo_id
    FROM public.anos_letivos
   WHERE escola_id = p_escola_id
     AND ano = p_ano_letivo
   LIMIT 1;

  IF v_ano_letivo_id IS NULL THEN
    RAISE EXCEPTION 'Ano letivo % não encontrado para a escola %.', p_ano_letivo, p_escola_id;
  END IF;

  WITH requested_classes AS (
    SELECT DISTINCT (value->>'classeId')::uuid AS classe_id
    FROM jsonb_array_elements(COALESCE(p_generation_params->'turmas', '[]'::jsonb))
    UNION
    SELECT DISTINCT (value->>'classeId')::uuid AS classe_id
    FROM jsonb_array_elements(COALESCE(p_generation_params->'classes', '[]'::jsonb))
  ),
  missing AS (
    SELECT rc.classe_id
    FROM requested_classes rc
    LEFT JOIN public.curso_curriculos cc
      ON cc.escola_id = p_escola_id
     AND cc.curso_id = p_curso_id
     AND cc.ano_letivo_id = v_ano_letivo_id
     AND cc.classe_id = rc.classe_id
     AND cc.status = 'published'
    WHERE rc.classe_id IS NOT NULL AND cc.id IS NULL
  )
  SELECT array_agg(cl.nome)
    INTO v_missing_classes
    FROM missing m
    JOIN public.classes cl ON cl.id = m.classe_id;

  IF v_missing_classes IS NOT NULL THEN
    RAISE EXCEPTION 'Currículo publicado não encontrado para: %', array_to_string(v_missing_classes, ', ');
  END IF;

  IF p_generation_params->'turmas' IS NOT NULL AND jsonb_array_length(p_generation_params->'turmas') > 0 THEN
    FOR v_turma_data IN SELECT jsonb_array_elements(p_generation_params->'turmas') LOOP
      v_quantidade := COALESCE((v_turma_data->>'quantidade')::int, 1);
      SELECT id
        INTO v_published_curriculo_id
        FROM public.curso_curriculos
       WHERE escola_id = p_escola_id
         AND curso_id = p_curso_id
         AND ano_letivo_id = v_ano_letivo_id
         AND status = 'published'
         AND classe_id = (v_turma_data->>'classeId')::uuid
       LIMIT 1;

      IF v_published_curriculo_id IS NULL THEN
        RAISE EXCEPTION 'Nenhum currículo publicado encontrado para a classe.';
      END IF;

      FOR i IN 1..v_quantidade LOOP
        v_turma_letter := letters[i];
        v_turma_nome_final := (v_turma_data->>'nome')::text || ' ' || v_turma_letter;

        INSERT INTO public.turmas (
          escola_id,
          curso_id,
          classe_id,
          ano_letivo,
          ano_letivo_id,
          nome,
          turno,
          capacidade_maxima,
          status_validacao
        )
        VALUES (
          p_escola_id,
          p_curso_id,
          (v_turma_data->>'classeId')::uuid,
          p_ano_letivo,
          v_ano_letivo_id,
          v_turma_nome_final,
          (v_turma_data->>'turno')::text,
          COALESCE(v_capacidade_maxima, 35),
          'ativo'
        )
        ON CONFLICT (escola_id, curso_id, classe_id, ano_letivo, nome, turno) DO NOTHING
        RETURNING id, nome INTO v_turma_id, v_turma_nome_final;

        IF v_turma_id IS NOT NULL THEN
          v_new_turmas_count := v_new_turmas_count + 1;
          FOR v_curso_matriz_item IN
            SELECT cm.id, cm.disciplina_id, cm.classe_id, cm.conta_para_media_med, dc.aplica_modelo_avaliacao_id
            FROM public.curso_matriz cm
            JOIN public.disciplinas_catalogo dc
              ON dc.id = cm.disciplina_id
            WHERE cm.escola_id = p_escola_id
              AND cm.curso_curriculo_id = v_published_curriculo_id
              AND cm.classe_id = (v_turma_data->>'classeId')::uuid
          LOOP
            INSERT INTO public.turma_disciplinas (
              escola_id,
              turma_id,
              curso_matriz_id,
              professor_id,
              modelo_avaliacao_id,
              conta_para_media_med
            )
            VALUES (
              p_escola_id,
              v_turma_id,
              v_curso_matriz_item.id,
              null,
              v_curso_matriz_item.aplica_modelo_avaliacao_id,
              COALESCE(v_curso_matriz_item.conta_para_media_med, true)
            )
            ON CONFLICT (escola_id, turma_id, curso_matriz_id) DO NOTHING;
            v_new_turma_disciplinas_count := v_new_turma_disciplinas_count + 1;
          END LOOP;
        END IF;
      END LOOP;
    END LOOP;
  ELSE
    IF p_generation_params->'classes' IS NOT NULL AND jsonb_array_length(p_generation_params->'classes') > 0 AND
       p_generation_params->'turnos' IS NOT NULL AND jsonb_array_length(p_generation_params->'turnos') > 0 THEN
      FOR v_turma_data IN SELECT jsonb_array_elements(p_generation_params->'classes') LOOP
        FOR v_turno IN SELECT jsonb_array_elements_text(p_generation_params->'turnos') LOOP
          v_quantidade := COALESCE((v_turma_data->>'quantidade')::int, 1);
          SELECT id
            INTO v_published_curriculo_id
            FROM public.curso_curriculos
           WHERE escola_id = p_escola_id
             AND curso_id = p_curso_id
             AND ano_letivo_id = v_ano_letivo_id
             AND status = 'published'
             AND classe_id = (v_turma_data->>'classeId')::uuid
           LIMIT 1;

          IF v_published_curriculo_id IS NULL THEN
            RAISE EXCEPTION 'Nenhum currículo publicado encontrado para a classe.';
          END IF;

          FOR i IN 1..v_quantidade LOOP
            v_turma_letter := letters[i];
            v_turma_nome_final := (v_turma_data->>'nome')::text || ' ' || v_turno || ' - ' || v_turma_letter;

            INSERT INTO public.turmas (
              escola_id,
              curso_id,
              classe_id,
              ano_letivo,
              ano_letivo_id,
              nome,
              turno,
              capacidade_maxima,
              status_validacao
            )
            VALUES (
              p_escola_id,
              p_curso_id,
              (v_turma_data->>'classeId')::uuid,
              p_ano_letivo,
              v_ano_letivo_id,
              v_turma_nome_final,
              v_turno::text,
              COALESCE(v_capacidade_maxima, 35),
              'ativo'
            )
            ON CONFLICT (escola_id, curso_id, classe_id, ano_letivo, nome, turno) DO NOTHING
            RETURNING id INTO v_turma_id;

            IF v_turma_id IS NOT NULL THEN
              v_new_turmas_count := v_new_turmas_count + 1;
              FOR v_curso_matriz_item IN
                SELECT cm.id, cm.disciplina_id, cm.classe_id, cm.conta_para_media_med, dc.aplica_modelo_avaliacao_id
                FROM public.curso_matriz cm
                JOIN public.disciplinas_catalogo dc
                  ON dc.id = cm.disciplina_id
                WHERE cm.escola_id = p_escola_id
                  AND cm.curso_curriculo_id = v_published_curriculo_id
                  AND cm.classe_id = (v_turma_data->>'classeId')::uuid
              LOOP
                INSERT INTO public.turma_disciplinas (
                  escola_id,
                  turma_id,
                  curso_matriz_id,
                  professor_id,
                  modelo_avaliacao_id,
                  conta_para_media_med
                )
                VALUES (
                  p_escola_id,
                  v_turma_id,
                  v_curso_matriz_item.id,
                  null,
                  v_curso_matriz_item.aplica_modelo_avaliacao_id,
                  COALESCE(v_curso_matriz_item.conta_para_media_med, true)
                )
                ON CONFLICT (escola_id, turma_id, curso_matriz_id) DO NOTHING;
                v_new_turma_disciplinas_count := v_new_turma_disciplinas_count + 1;
              END LOOP;
            END IF;
          END LOOP;
        END LOOP;
      END LOOP;
    END IF;
  END IF;

  IF v_new_turmas_count = 0 THEN
    RAISE EXCEPTION 'Nenhuma turma foi gerada. Verifique os parâmetros de entrada.';
  END IF;

  PERFORM public.curriculo_create_avaliacoes_for_turmas(
    p_escola_id,
    p_curso_id,
    v_ano_letivo_id,
    NULL
  );

  INSERT INTO public.audit_logs (
    escola_id,
    actor_id,
    action,
    entity,
    portal,
    details
  ) VALUES (
    p_escola_id,
    v_actor_id,
    'TURMAS_GERADAS_FROM_CURRICULO',
    'turmas',
    'admin',
    jsonb_build_object(
      'curso_id', p_curso_id,
      'ano_letivo', p_ano_letivo,
      'turmas_count', v_new_turmas_count,
      'turma_disciplinas_count', v_new_turma_disciplinas_count,
      'generation_params', p_generation_params,
      'idempotency_key', p_idempotency_key
    )
  ) RETURNING id INTO v_existing_audit;

  RETURN jsonb_build_object(
    'ok', true,
    'turmas_criadas', v_new_turmas_count,
    'turma_disciplinas_criadas', v_new_turma_disciplinas_count,
    'audit_log_id', v_existing_audit
  );
END;
$$;

ALTER FUNCTION public.gerar_turmas_from_curriculo(uuid, uuid, integer, jsonb, text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.gerar_turmas_from_curriculo(uuid, uuid, integer, jsonb, text) TO authenticated;

COMMIT;
