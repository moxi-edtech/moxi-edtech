BEGIN;

CREATE OR REPLACE FUNCTION public.curriculo_install_orchestrated(
  p_escola_id uuid,
  p_preset_key text,
  p_ano_letivo_id uuid,
  p_auto_publish boolean DEFAULT false,
  p_generate_turmas boolean DEFAULT true,
  p_custom_data jsonb DEFAULT NULL,
  p_advanced_config jsonb DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escola_id uuid := public.current_tenant_escola_id();
  v_actor_id uuid := auth.uid();
  v_has_permission boolean := false;

  v_ano_letivo integer;
  v_course_code text;
  v_course_name text;
  v_label text;
  v_curso_id uuid;

  v_published_exists boolean := false;
  v_new_version integer;
  v_new_curriculo_id uuid;

  v_subject_name text;
  v_disciplina_id uuid;

  v_apply_rows integer := 0;
  v_backfill_inserted integer := 0;
  v_turmas_existing integer := 0;

  v_publish record;
  v_publish_payload jsonb := NULL;
  v_matriz_payload jsonb := NULL;
  v_turmas_payload jsonb := NULL;

  v_turnos jsonb := '["M"]'::jsonb;
  v_classes_payload jsonb := '[]'::jsonb;
  v_generation_params jsonb;

  v_step_apply jsonb := jsonb_build_object('stage', 'apply', 'status', 'pending');
  v_step_publish jsonb := jsonb_build_object('stage', 'publish', 'status', 'skipped');
  v_step_backfill jsonb := jsonb_build_object('stage', 'backfill_matriz', 'status', 'pending');
  v_step_generate jsonb := jsonb_build_object('stage', 'generate_turmas', 'status', 'skipped');
BEGIN
  IF v_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  SELECT public.user_has_role_in_school(v_escola_id, ARRAY['admin_escola', 'secretaria', 'admin'])
    INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  PERFORM public.lock_curriculo_install(v_escola_id, p_preset_key, p_ano_letivo_id);

  SELECT al.ano
    INTO v_ano_letivo
    FROM public.anos_letivos al
   WHERE al.escola_id = v_escola_id
     AND al.id = p_ano_letivo_id
   LIMIT 1;

  IF v_ano_letivo IS NULL THEN
    RAISE EXCEPTION 'DATA: Ano letivo não encontrado para a escola.';
  END IF;

  SELECT trim(upper(coalesce(cp.course_code, ''))), cp.name
    INTO v_course_code, v_course_name
    FROM public.curriculum_presets cp
   WHERE cp.id = p_preset_key
   LIMIT 1;

  IF coalesce(v_course_code, '') = '' THEN
    RAISE EXCEPTION 'DATA: Preset inválido (course_code ausente).';
  END IF;

  v_label := coalesce(nullif(trim(p_custom_data->>'label'), ''), nullif(trim(v_course_name), ''), v_course_code);

  INSERT INTO public.cursos (
    escola_id,
    nome,
    tipo,
    codigo,
    course_code,
    curriculum_key,
    status_aprovacao,
    is_custom,
    created_at,
    updated_at
  ) VALUES (
    v_escola_id,
    v_label,
    'geral',
    v_course_code,
    v_course_code,
    p_preset_key,
    'aprovado',
    COALESCE((p_custom_data IS NOT NULL), false),
    now(),
    now()
  )
  ON CONFLICT (escola_id, codigo)
  DO UPDATE SET
    nome = EXCLUDED.nome,
    course_code = EXCLUDED.course_code,
    curriculum_key = EXCLUDED.curriculum_key,
    updated_at = now()
  RETURNING id INTO v_curso_id;

  SELECT EXISTS (
    SELECT 1
      FROM public.curso_curriculos cc
     WHERE cc.escola_id = v_escola_id
       AND cc.curso_id = v_curso_id
       AND cc.ano_letivo_id = p_ano_letivo_id
       AND cc.status = 'published'
  )
  INTO v_published_exists;

  IF v_published_exists THEN
    RETURN jsonb_build_object(
      'ok', false,
      'step', 'already_published',
      'code', 'CURRICULO_JA_PUBLICADO',
      'error', 'Ja existe curriculo publicado para este curso/ano letivo. Nenhuma alteracao foi aplicada.',
      'message', 'Ja existe curriculo publicado para este curso/ano letivo. Nenhuma alteracao foi aplicada.',
      'partial_failed', false,
      'applied', jsonb_build_object(
        'skipped', true,
        'reason', 'already_published',
        'reason_code', 'CURRICULO_JA_PUBLICADO'
      ),
      'operation_status', jsonb_build_object(
        'apply', jsonb_build_object('stage', 'apply', 'status', 'skipped'),
        'publish', jsonb_build_object('stage', 'publish', 'status', 'skipped'),
        'backfill_matriz', jsonb_build_object('stage', 'backfill_matriz', 'status', 'skipped'),
        'generate_turmas', jsonb_build_object('stage', 'generate_turmas', 'status', 'skipped')
      )
    );
  END IF;

  CREATE TEMP TABLE tmp_selected_subjects (
    preset_subject_id uuid,
    grade_level text,
    subject_name text,
    weekly_hours numeric,
    conta_para_media_med boolean
  ) ON COMMIT DROP;

  INSERT INTO tmp_selected_subjects (preset_subject_id, grade_level, subject_name, weekly_hours, conta_para_media_med)
  WITH base AS (
    SELECT
      cps.id AS preset_subject_id,
      trim(cps.grade_level) AS grade_level,
      trim(coalesce(nullif(ss.custom_name, ''), cps.name)) AS subject_name,
      coalesce(ss.custom_weekly_hours, cps.weekly_hours, 0) AS weekly_hours,
      coalesce(ss.conta_para_media_med, cps.conta_para_media_med, true) AS conta_para_media_med,
      coalesce(ss.is_active, cps.is_active, true) AS is_active
    FROM public.curriculum_preset_subjects cps
    LEFT JOIN public.school_subjects ss
      ON ss.escola_id = v_escola_id
     AND ss.preset_subject_id = cps.id
    WHERE cps.preset_id = p_preset_key
  )
  SELECT
    b.preset_subject_id,
    b.grade_level,
    b.subject_name,
    b.weekly_hours,
    b.conta_para_media_med
  FROM base b
  WHERE b.is_active = true
    AND (
      p_advanced_config IS NULL
      OR NOT (p_advanced_config ? 'classes')
      OR b.grade_level IN (
        SELECT jsonb_array_elements_text(p_advanced_config->'classes')
      )
    )
    AND (
      p_advanced_config IS NULL
      OR NOT (p_advanced_config ? 'subjects')
      OR b.subject_name IN (
        SELECT jsonb_array_elements_text(p_advanced_config->'subjects')
      )
    )
    AND (
      p_advanced_config IS NULL
      OR NOT (p_advanced_config ? 'matrix')
      OR coalesce((p_advanced_config->'matrix'->>(b.subject_name || '::' || b.grade_level || '::M'))::boolean, false)
      OR coalesce((p_advanced_config->'matrix'->>(b.subject_name || '::' || b.grade_level || '::T'))::boolean, false)
      OR coalesce((p_advanced_config->'matrix'->>(b.subject_name || '::' || b.grade_level || '::N'))::boolean, false)
    );

  IF NOT EXISTS (SELECT 1 FROM tmp_selected_subjects) THEN
    RAISE EXCEPTION 'DATA: Nenhuma disciplina/classe ativa para aplicar.';
  END IF;

  INSERT INTO public.classes (escola_id, curso_id, nome)
  SELECT DISTINCT
    v_escola_id,
    v_curso_id,
    t.grade_level
  FROM tmp_selected_subjects t
  ON CONFLICT (escola_id, curso_id, nome) DO NOTHING;

  SELECT coalesce(max(cc.version), 0) + 1
    INTO v_new_version
    FROM public.curso_curriculos cc
   WHERE cc.escola_id = v_escola_id
     AND cc.curso_id = v_curso_id
     AND cc.ano_letivo_id = p_ano_letivo_id;

  CREATE TEMP TABLE tmp_curriculos (
    classe_id uuid PRIMARY KEY,
    curriculo_id uuid NOT NULL
  ) ON COMMIT DROP;

  WITH inserted_curriculos AS (
    INSERT INTO public.curso_curriculos (
      escola_id,
      curso_id,
      ano_letivo_id,
      status,
      version,
      classe_id,
      created_by
    )
    SELECT
      v_escola_id,
      v_curso_id,
      p_ano_letivo_id,
      'draft',
      v_new_version,
      c.id,
      v_actor_id
    FROM public.classes c
    JOIN (
      SELECT DISTINCT grade_level FROM tmp_selected_subjects
    ) g ON g.grade_level = c.nome
    WHERE c.escola_id = v_escola_id
      AND c.curso_id = v_curso_id
    RETURNING classe_id, id
  )
  INSERT INTO tmp_curriculos (classe_id, curriculo_id)
  SELECT classe_id, id
  FROM inserted_curriculos;

  SELECT tc.curriculo_id
    INTO v_new_curriculo_id
    FROM tmp_curriculos tc
   LIMIT 1;

  IF v_new_curriculo_id IS NULL THEN
    RAISE EXCEPTION 'DATA: Falha ao criar rascunho de currículo.';
  END IF;

  CREATE TEMP TABLE tmp_disciplinas (
    nome text PRIMARY KEY,
    disciplina_id uuid NOT NULL
  ) ON COMMIT DROP;

  FOR v_subject_name IN
    SELECT DISTINCT subject_name
      FROM tmp_selected_subjects
  LOOP
    SELECT dc.id
      INTO v_disciplina_id
      FROM public.disciplinas_catalogo dc
     WHERE dc.escola_id = v_escola_id
       AND lower(trim(dc.nome)) = lower(trim(v_subject_name))
     LIMIT 1;

    IF v_disciplina_id IS NULL THEN
      INSERT INTO public.disciplinas_catalogo (escola_id, nome)
      VALUES (v_escola_id, v_subject_name)
      RETURNING id INTO v_disciplina_id;
    END IF;

    INSERT INTO tmp_disciplinas (nome, disciplina_id)
    VALUES (v_subject_name, v_disciplina_id)
    ON CONFLICT (nome) DO UPDATE SET disciplina_id = EXCLUDED.disciplina_id;
  END LOOP;

  INSERT INTO public.curso_matriz (
    escola_id,
    curso_id,
    classe_id,
    disciplina_id,
    curso_curriculo_id,
    preset_subject_id,
    carga_horaria,
    carga_horaria_semanal,
    obrigatoria,
    classificacao,
    ordem,
    ativo,
    periodos_ativos,
    entra_no_horario,
    avaliacao_mode,
    status_completude,
    conta_para_media_med
  )
  SELECT
    v_escola_id,
    v_curso_id,
    c.id,
    d.disciplina_id,
    tc.curriculo_id,
    t.preset_subject_id,
    NULL,
    t.weekly_hours,
    true,
    'core',
    row_number() OVER (PARTITION BY c.id ORDER BY t.subject_name),
    true,
    ARRAY[1,2,3],
    true,
    'inherit_school',
    'incompleto',
    coalesce(t.conta_para_media_med, true)
  FROM tmp_selected_subjects t
  JOIN public.classes c
    ON c.escola_id = v_escola_id
   AND c.curso_id = v_curso_id
   AND c.nome = t.grade_level
  JOIN tmp_curriculos tc
    ON tc.classe_id = c.id
  JOIN tmp_disciplinas d
    ON d.nome = t.subject_name
  ON CONFLICT (escola_id, curso_id, classe_id, disciplina_id, curso_curriculo_id)
  DO UPDATE SET
    carga_horaria_semanal = EXCLUDED.carga_horaria_semanal,
    preset_subject_id = EXCLUDED.preset_subject_id,
    conta_para_media_med = EXCLUDED.conta_para_media_med,
    ativo = true,
    entra_no_horario = true,
    periodos_ativos = EXCLUDED.periodos_ativos,
    avaliacao_mode = EXCLUDED.avaliacao_mode,
    status_completude = EXCLUDED.status_completude;

  GET DIAGNOSTICS v_apply_rows = ROW_COUNT;
  IF v_apply_rows = 0 THEN
    RAISE EXCEPTION 'DATA: Falha ao aplicar matriz do currículo.';
  END IF;

  v_step_apply := jsonb_build_object('stage', 'apply', 'status', 'success');

  IF p_auto_publish THEN
    SELECT *
      INTO v_publish
      FROM public.curriculo_publish(
        v_escola_id,
        v_curso_id,
        p_ano_letivo_id,
        v_new_version,
        false
      )
     LIMIT 1;

    IF coalesce(v_publish.ok, false) IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'PUBLISH: %', coalesce(v_publish.message, 'Falha ao publicar currículo.');
    END IF;

    v_publish_payload := jsonb_build_object(
      'ok', v_publish.ok,
      'message', v_publish.message,
      'published_curriculo_id', v_publish.published_curriculo_id,
      'previous_published_curriculo_id', v_publish.previous_published_curriculo_id,
      'pendencias', v_publish.pendencias,
      'pendencias_count', v_publish.pendencias_count
    );
    v_step_publish := jsonb_build_object('stage', 'publish', 'status', 'success');
  ELSE
    v_step_publish := jsonb_build_object('stage', 'publish', 'status', 'skipped');
  END IF;

  SELECT count(*)
    INTO v_apply_rows
    FROM public.curso_matriz cm
   WHERE cm.escola_id = v_escola_id
     AND cm.curso_id = v_curso_id;

  IF v_apply_rows = 0 THEN
    v_backfill_inserted := public.curriculo_backfill_matriz_from_preset(v_escola_id, v_curso_id);
    IF coalesce(v_backfill_inserted, 0) <= 0 THEN
      RAISE EXCEPTION 'BACKFILL: Nenhuma disciplina gerada para o currículo.';
    END IF;
    v_matriz_payload := jsonb_build_object('ok', true, 'inserted', v_backfill_inserted);
    v_step_backfill := jsonb_build_object('stage', 'backfill_matriz', 'status', 'success');
  ELSE
    v_matriz_payload := NULL;
    v_step_backfill := jsonb_build_object('stage', 'backfill_matriz', 'status', 'skipped');
  END IF;

  IF p_generate_turmas THEN
    IF NOT p_auto_publish THEN
      v_turmas_payload := jsonb_build_object(
        'ok', true,
        'skipped', true,
        'message', 'Geração de turmas depende de currículo publicado (autoPublish=false).'
      );
      v_step_generate := jsonb_build_object('stage', 'generate_turmas', 'status', 'skipped');
    ELSE
      SELECT count(*)
        INTO v_turmas_existing
        FROM public.turmas t
       WHERE t.escola_id = v_escola_id
         AND t.curso_id = v_curso_id
         AND t.ano_letivo = v_ano_letivo;

      IF v_turmas_existing > 0 THEN
        v_turmas_payload := jsonb_build_object(
          'ok', true,
          'skipped', true,
          'message', 'Turmas já existentes.'
        );
        v_step_generate := jsonb_build_object('stage', 'generate_turmas', 'status', 'skipped');
      ELSE
        IF p_advanced_config IS NOT NULL AND (p_advanced_config ? 'turnos') THEN
          SELECT coalesce(jsonb_agg(x.turno), '["M"]'::jsonb)
            INTO v_turnos
            FROM (
              SELECT 'M'::text AS turno WHERE coalesce((p_advanced_config->'turnos'->>'manha')::boolean, false)
              UNION ALL
              SELECT 'T'::text AS turno WHERE coalesce((p_advanced_config->'turnos'->>'tarde')::boolean, false)
              UNION ALL
              SELECT 'N'::text AS turno WHERE coalesce((p_advanced_config->'turnos'->>'noite')::boolean, false)
            ) x;
          IF jsonb_array_length(v_turnos) = 0 THEN
            v_turnos := '["M"]'::jsonb;
          END IF;
        END IF;

        SELECT coalesce(
          jsonb_agg(
            jsonb_build_object(
              'classeId', c.id,
              'nome', c.nome,
              'quantidade', 1
            )
          ),
          '[]'::jsonb
        )
          INTO v_classes_payload
          FROM public.classes c
          JOIN (
            SELECT DISTINCT grade_level FROM tmp_selected_subjects
          ) g ON g.grade_level = c.nome
         WHERE c.escola_id = v_escola_id
           AND c.curso_id = v_curso_id;

        IF jsonb_array_length(v_classes_payload) = 0 THEN
          RAISE EXCEPTION 'GENERATE_TURMAS: Sem classes elegíveis para geração.';
        END IF;

        v_generation_params := jsonb_build_object(
          'cursoId', v_curso_id,
          'anoLetivo', v_ano_letivo,
          'classes', v_classes_payload,
          'turnos', v_turnos
        );

        v_turmas_payload := public.gerar_turmas_from_curriculo(
          v_escola_id,
          v_curso_id,
          v_ano_letivo,
          v_generation_params,
          coalesce(nullif(p_idempotency_key, ''), gen_random_uuid()::text)
        );

        IF coalesce((v_turmas_payload->>'ok')::boolean, false) IS DISTINCT FROM true THEN
          RAISE EXCEPTION 'GENERATE_TURMAS: %', coalesce(v_turmas_payload->>'message', 'Falha ao gerar turmas.');
        END IF;

        v_step_generate := jsonb_build_object('stage', 'generate_turmas', 'status', 'success');
      END IF;
    END IF;
  ELSE
    v_step_generate := jsonb_build_object('stage', 'generate_turmas', 'status', 'skipped');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'success',
    'partial_failed', false,
    'presetKey', p_preset_key,
    'ano_letivo_id', p_ano_letivo_id,
    'applied', jsonb_build_object(
      'curso_id', v_curso_id,
      'curso_curriculo_id', v_new_curriculo_id,
      'version', v_new_version,
      'status', 'draft'
    ),
    'publish', v_publish_payload,
    'turmas', v_turmas_payload,
    'matriz', v_matriz_payload,
    'operation_status', jsonb_build_object(
      'apply', v_step_apply,
      'publish', v_step_publish,
      'backfill_matriz', v_step_backfill,
      'generate_turmas', v_step_generate
    ),
    'message', 'Instalação concluída com sucesso.'
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'CURRICULO_INSTALL: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.curriculo_install_orchestrated(
  uuid,
  text,
  uuid,
  boolean,
  boolean,
  jsonb,
  jsonb,
  text
) TO authenticated;

COMMIT;
