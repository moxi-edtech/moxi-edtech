BEGIN;

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
  v_course_code text;
  v_class_name text;
  v_class_number text;
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

  SELECT
      regexp_replace(upper(coalesce(course_code, codigo, left(nome, 3))), '[^A-Z0-9]', '', 'g')
    INTO v_course_code
    FROM public.cursos
   WHERE escola_id = p_escola_id
     AND id = p_curso_id
   LIMIT 1;

  IF v_course_code IS NULL OR length(trim(v_course_code)) = 0 THEN
    v_course_code := 'CUR';
  END IF;

  SELECT id
    INTO v_published_curriculo_id
    FROM public.curso_curriculos
   WHERE escola_id = p_escola_id
     AND curso_id = p_curso_id
     AND ano_letivo_id = v_ano_letivo_id
     AND status = 'published'
   LIMIT 1;

  IF v_published_curriculo_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum currículo publicado encontrado para o Curso % no Ano Letivo %.', p_curso_id, p_ano_letivo;
  END IF;

  IF p_generation_params->'turmas' IS NOT NULL AND jsonb_array_length(p_generation_params->'turmas') > 0 THEN
    FOR v_turma_data IN SELECT jsonb_array_elements(p_generation_params->'turmas') LOOP
      v_quantidade := COALESCE((v_turma_data->>'quantidade')::int, 1);
      FOR i IN 1..v_quantidade LOOP
        v_turma_letter := letters[i];
        v_turno := (v_turma_data->>'turno')::text;

        SELECT nome
          INTO v_class_name
          FROM public.classes
         WHERE escola_id = p_escola_id
           AND id = (v_turma_data->>'classeId')::uuid
         LIMIT 1;

        v_class_number := regexp_replace(coalesce(v_class_name, ''), '\\D', '', 'g');
        IF v_class_number IS NULL OR length(trim(v_class_number)) = 0 THEN
          v_class_number := regexp_replace(upper(coalesce(v_class_name, '')), '\\s+', '', 'g');
        END IF;

        v_turma_nome_final := v_course_code || '-' || v_class_number || '-' || upper(v_turno) || '-' || v_turma_letter;

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
          v_turno,
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
          FOR i IN 1..v_quantidade LOOP
          v_turma_letter := letters[i];
          SELECT nome
            INTO v_class_name
            FROM public.classes
           WHERE escola_id = p_escola_id
             AND id = (v_turma_data->>'classeId')::uuid
           LIMIT 1;

          v_class_number := regexp_replace(coalesce(v_class_name, ''), '\\D', '', 'g');
          IF v_class_number IS NULL OR length(trim(v_class_number)) = 0 THEN
            v_class_number := regexp_replace(upper(coalesce(v_class_name, '')), '\\s+', '', 'g');
          END IF;

          v_turma_nome_final := v_course_code || '-' || v_class_number || '-' || upper(v_turno) || '-' || v_turma_letter;

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
