BEGIN;

CREATE OR REPLACE FUNCTION public.setup_active_ano_letivo(
  p_escola_id uuid,
  p_ano_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := (p_ano_data->>'id')::uuid;
  v_ano int := (p_ano_data->>'ano')::int;
  v_data_inicio date := (p_ano_data->>'data_inicio')::date;
  v_data_fim date := (p_ano_data->>'data_fim')::date;
  v_ativo boolean := (p_ano_data->>'ativo')::boolean;
  v_escola_id uuid := public.current_tenant_escola_id();
  v_has_permission boolean;
  v_old_record public.anos_letivos;
  v_new_record public.anos_letivos;
  v_actor_id uuid := auth.uid();
BEGIN
  IF v_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;
  SELECT public.user_has_role_in_school(v_escola_id, ARRAY['admin', 'admin_escola'])
  INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  IF v_id IS NOT NULL THEN
    SELECT * INTO v_old_record FROM public.anos_letivos WHERE id = v_id AND escola_id = v_escola_id;
  END IF;

  IF v_ativo THEN
    UPDATE public.anos_letivos
    SET ativo = false
    WHERE escola_id = v_escola_id
      AND ativo = true
      AND id IS DISTINCT FROM v_id;
  END IF;

  INSERT INTO public.anos_letivos (id, escola_id, ano, data_inicio, data_fim, ativo)
  VALUES (
    COALESCE(v_id, gen_random_uuid()),
    v_escola_id,
    v_ano,
    v_data_inicio,
    v_data_fim,
    v_ativo
  )
  ON CONFLICT (escola_id, ano) DO UPDATE SET
    data_inicio = EXCLUDED.data_inicio,
    data_fim = EXCLUDED.data_fim,
    ativo = EXCLUDED.ativo,
    updated_at = now()
  RETURNING * INTO v_new_record;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, before, after, portal)
  VALUES (
    v_escola_id,
    v_actor_id,
    CASE WHEN v_old_record IS NULL THEN 'CREATE' ELSE 'UPDATE' END,
    'anos_letivos',
    v_new_record.id::text,
    to_jsonb(v_old_record),
    to_jsonb(v_new_record),
    'admin'
  );

  RETURN to_jsonb(v_new_record);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Database constraint violation: It is not possible to have two active school years at the same time.' USING ERRCODE = '23505';
  WHEN others THEN
    RAISE;
END;
$$;

ALTER FUNCTION public.setup_active_ano_letivo(uuid, jsonb) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.setup_active_ano_letivo(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.importar_alunos_v2(
  p_escola_id uuid,
  p_ano_letivo integer,
  p_import_id uuid,
  p_alunos jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano_id uuid;
  v_total int := 0;
  v_sucesso int := 0;
  v_erros int := 0;
  v_detail jsonb := '[]'::jsonb;
  rec jsonb;
  v_aluno_id uuid;
  v_turma_id uuid;
  v_turma_nome text;
  v_curso_id uuid;
  v_classe_id uuid;
  v_bi text;
  v_nome text;
  v_escola_id uuid := public.current_tenant_escola_id();
  v_has_permission boolean;
BEGIN
  IF p_escola_id IS NULL THEN
    RAISE EXCEPTION 'p_escola_id é obrigatório';
  END IF;
  IF p_ano_letivo IS NULL THEN
    RAISE EXCEPTION 'p_ano_letivo é obrigatório';
  END IF;
  IF v_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido';
  END IF;
  SELECT public.user_has_role_in_school(v_escola_id, ARRAY['secretaria', 'admin', 'admin_escola'])
  INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada';
  END IF;

  SELECT (
    public.setup_active_ano_letivo(
      v_escola_id,
      jsonb_build_object(
        'ano', p_ano_letivo,
        'data_inicio', to_date(p_ano_letivo::text || '-01-01', 'YYYY-MM-DD'),
        'data_fim', to_date(p_ano_letivo::text || '-12-31', 'YYYY-MM-DD'),
        'ativo', true
      )
    ) ->> 'id'
  )::uuid INTO v_ano_id;

  FOR rec IN SELECT * FROM jsonb_array_elements(p_alunos) LOOP
    v_total := v_total + 1;
    v_aluno_id := COALESCE((rec->>'aluno_id')::uuid, gen_random_uuid());
    v_turma_id := (rec->>'turma_id')::uuid;
    v_turma_nome := nullif(rec->>'turma_nome','');
    v_curso_id := (rec->>'curso_id')::uuid;
    v_classe_id := (rec->>'classe_id')::uuid;
    v_bi := nullif(rec->>'bi','');
    v_nome := nullif(rec->>'nome','');

    BEGIN
      IF v_nome IS NULL THEN
        RAISE EXCEPTION 'Nome do aluno ausente';
      END IF;

      INSERT INTO alunos(id, escola_id, nome, bi_numero, import_id)
      VALUES (v_aluno_id, v_escola_id, v_nome, v_bi, p_import_id)
      ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, bi_numero = EXCLUDED.bi_numero;

      IF v_turma_id IS NULL THEN
        IF v_curso_id IS NOT NULL AND v_classe_id IS NOT NULL THEN
          SELECT id INTO v_turma_id
          FROM turmas
          WHERE escola_id = v_escola_id
            AND curso_id = v_curso_id
            AND classe_id = v_classe_id
            AND ano_letivo = p_ano_letivo
          LIMIT 1;
        END IF;

        IF v_turma_id IS NULL AND v_turma_nome IS NOT NULL THEN
          SELECT id INTO v_turma_id
          FROM turmas
          WHERE escola_id = v_escola_id
            AND nome = v_turma_nome
            AND ano_letivo = p_ano_letivo
          LIMIT 1;
        END IF;
      END IF;

      IF v_turma_id IS NULL THEN
        IF v_curso_id IS NULL OR v_classe_id IS NULL THEN
          RAISE EXCEPTION 'Sem turma e sem curso/classe para criar';
        END IF;
        INSERT INTO turmas (escola_id, nome, curso_id, classe_id, turno, ano_letivo)
        VALUES (v_escola_id, COALESCE(v_turma_nome, 'Turma '||v_classe_id||' '||p_ano_letivo), v_curso_id, v_classe_id, 'M', p_ano_letivo)
        RETURNING id INTO v_turma_id;
      END IF;

      INSERT INTO matriculas (id, escola_id, aluno_id, turma_id, ano_letivo, ano_letivo_id, status, import_id)
      VALUES (gen_random_uuid(), v_escola_id, v_aluno_id, v_turma_id, p_ano_letivo, v_ano_id, 'ativa', p_import_id)
      ON CONFLICT (aluno_id, turma_id) DO NOTHING;

      v_sucesso := v_sucesso + 1;
      v_detail := v_detail || jsonb_build_array(jsonb_build_object('aluno', v_nome, 'status', 'ok'));
    EXCEPTION WHEN OTHERS THEN
      v_erros := v_erros + 1;
      v_detail := v_detail || jsonb_build_array(jsonb_build_object('aluno', v_nome, 'status', 'erro', 'msg', SQLERRM));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'total', v_total,
    'sucesso', v_sucesso,
    'erros', v_erros,
    'detail', v_detail
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_bulk_periodos_letivos(
  p_escola_id uuid,
  p_periodos_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_periodo_data jsonb;
  v_old_record public.periodos_letivos;
  v_new_record public.periodos_letivos;
  v_results jsonb[] := '{}';
  v_actor_id uuid := auth.uid();
  v_escola_id uuid := public.current_tenant_escola_id();
  v_has_permission boolean;
BEGIN
  IF v_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;
  SELECT public.user_has_role_in_school(v_escola_id, ARRAY['admin', 'admin_escola'])
  INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  FOR v_periodo_data IN SELECT * FROM jsonb_array_elements(p_periodos_data) LOOP
    IF v_periodo_data ? 'id' THEN
      SELECT * INTO v_old_record
      FROM public.periodos_letivos
      WHERE id = (v_periodo_data->>'id')::uuid AND escola_id = v_escola_id;
    ELSE
      v_old_record := NULL;
    END IF;

    INSERT INTO public.periodos_letivos (
      id,
      escola_id,
      ano_letivo_id,
      tipo,
      numero,
      data_inicio,
      data_fim,
      trava_notas_em
    )
    VALUES (
      COALESCE((v_periodo_data->>'id')::uuid, gen_random_uuid()),
      v_escola_id,
      (v_periodo_data->>'ano_letivo_id')::uuid,
      (v_periodo_data->>'tipo')::periodo_tipo,
      (v_periodo_data->>'numero')::int,
      (v_periodo_data->>'data_inicio')::date,
      (v_periodo_data->>'data_fim')::date,
      (v_periodo_data->>'trava_notas_em')::timestamptz
    )
    ON CONFLICT (escola_id, ano_letivo_id, tipo, numero) DO UPDATE SET
      data_inicio = EXCLUDED.data_inicio,
      data_fim = EXCLUDED.data_fim,
      trava_notas_em = EXCLUDED.trava_notas_em,
      updated_at = now()
    RETURNING * INTO v_new_record;

    v_results := array_append(v_results, to_jsonb(v_new_record));

    INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, before, after, portal)
    VALUES (
      v_escola_id,
      v_actor_id,
      CASE WHEN v_old_record IS NULL THEN 'CREATE' ELSE 'UPDATE' END,
      'periodos_letivos',
      v_new_record.id::text,
      to_jsonb(v_old_record),
      to_jsonb(v_new_record),
      'admin'
    );
  END LOOP;

  RETURN jsonb_build_object('data', v_results);
EXCEPTION
  WHEN others THEN
    RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.gerar_turmas_from_curriculo(
  p_escola_id uuid,
  p_curso_id uuid,
  p_ano_letivo integer,
  p_generation_params jsonb
)
RETURNS TABLE (
  turma_id uuid,
  turma_nome text,
  disciplinas_criadas integer
)
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
  v_generated_turmas jsonb[] := '{}';
  v_turno text;
  v_escola_id uuid := public.current_tenant_escola_id();
  v_has_permission boolean;
  letters text[] := ARRAY['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];
  v_turma_letter text;
  v_turma_nome_final text;
  v_quantidade int;
  v_capacidade_maxima int := (p_generation_params->>'capacidadeMaxima')::int;
  v_curso_matriz_item record;
BEGIN
  IF v_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;
  SELECT public.user_has_role_in_school(v_escola_id, ARRAY['admin', 'admin_escola'])
  INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  SELECT id INTO v_ano_letivo_id
  FROM public.anos_letivos
  WHERE escola_id = v_escola_id AND ano = p_ano_letivo
  LIMIT 1;

  IF v_ano_letivo_id IS NULL THEN
    RAISE EXCEPTION 'Ano letivo % não encontrado para a escola %.', p_ano_letivo, p_escola_id;
  END IF;

  SELECT id INTO v_published_curriculo_id
  FROM public.curso_curriculos
  WHERE escola_id = v_escola_id
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
          v_escola_id,
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
        RETURNING id, nome INTO v_turma_id, turma_nome;

        IF v_turma_id IS NOT NULL THEN
          v_new_turmas_count := v_new_turmas_count + 1;
          FOR v_curso_matriz_item IN
            SELECT cm.disciplina_id, cm.classe_id, cm.carga_horaria_semanal, cm.modelo_avaliacao
            FROM public.curso_matriz cm
            WHERE cm.escola_id = v_escola_id
              AND cm.curso_curriculo_id = v_published_curriculo_id
              AND cm.classe_id = (v_turma_data->>'classeId')::uuid
          LOOP
            INSERT INTO public.turma_disciplinas (
              escola_id,
              turma_id,
              disciplina_id,
              classe_id,
              ano_letivo_id,
              carga_horaria_semanal,
              modelo_avaliacao
            )
            VALUES (
              v_escola_id,
              v_turma_id,
              v_curso_matriz_item.disciplina_id,
              v_curso_matriz_item.classe_id,
              v_ano_letivo_id,
              v_curso_matriz_item.carga_horaria_semanal,
              v_curso_matriz_item.modelo_avaliacao
            )
            ON CONFLICT (turma_id, disciplina_id) DO NOTHING;
            v_new_turma_disciplinas_count := v_new_turma_disciplinas_count + 1;
          END LOOP;
          v_generated_turmas := array_append(v_generated_turmas, jsonb_build_object('id', v_turma_id, 'nome', turma_nome, 'disciplinas_count', v_new_turma_disciplinas_count));
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
              v_escola_id,
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
            RETURNING id, nome INTO v_turma_id, turma_nome;

            IF v_turma_id IS NOT NULL THEN
              v_new_turmas_count := v_new_turmas_count + 1;
              FOR v_curso_matriz_item IN
                SELECT cm.disciplina_id, cm.classe_id, cm.carga_horaria_semanal, cm.modelo_avaliacao
                FROM public.curso_matriz cm
                WHERE cm.escola_id = v_escola_id
                  AND cm.curso_curriculo_id = v_published_curriculo_id
                  AND cm.classe_id = (v_turma_data->>'classeId')::uuid
              LOOP
                INSERT INTO public.turma_disciplinas (
                  escola_id,
                  turma_id,
                  disciplina_id,
                  classe_id,
                  ano_letivo_id,
                  carga_horaria_semanal,
                  modelo_avaliacao
                )
                VALUES (
                  v_escola_id,
                  v_turma_id,
                  v_curso_matriz_item.disciplina_id,
                  v_curso_matriz_item.classe_id,
                  v_ano_letivo_id,
                  v_curso_matriz_item.carga_horaria_semanal,
                  v_curso_matriz_item.modelo_avaliacao
                )
                ON CONFLICT (turma_id, disciplina_id) DO NOTHING;
                v_new_turma_disciplinas_count := v_new_turma_disciplinas_count + 1;
              END LOOP;
              v_generated_turmas := array_append(v_generated_turmas, jsonb_build_object('id', v_turma_id, 'nome', turma_nome, 'disciplinas_count', v_new_turma_disciplinas_count));
            END IF;
          END LOOP;
        END LOOP;
      END LOOP;
    END IF;
  END IF;

  IF v_new_turmas_count = 0 THEN
    RAISE EXCEPTION 'Nenhuma turma foi gerada. Verifique os parâmetros de entrada.';
  END IF;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, before, after, portal, details)
  VALUES (
    v_escola_id,
    v_actor_id,
    'TURMAS_GERADAS_FROM_CURRICULO',
    'turmas',
    null,
    null,
    jsonb_build_object('turmas_geradas', v_generated_turmas),
    'admin',
    jsonb_build_object(
      'curso_id', p_curso_id,
      'ano_letivo', p_ano_letivo,
      'turmas_count', v_new_turmas_count,
      'turma_disciplinas_count', v_new_turma_disciplinas_count,
      'generation_params', p_generation_params
    )
  );

  RETURN QUERY SELECT * FROM (
    SELECT 
      (elem->>'id')::uuid as turma_id, 
      (elem->>'nome')::text as turma_nome, 
      (elem->>'disciplinas_count')::integer as disciplinas_criadas
    FROM jsonb_array_elements(jsonb_build_array(v_generated_turmas)) AS elem
  ) AS subquery;
END;
$$;

CREATE OR REPLACE FUNCTION public.onboard_academic_structure_from_matrix(
  p_escola_id uuid,
  p_session_id text,
  p_matrix jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_summary jsonb := jsonb_build_object(
    'cursos', jsonb_build_object('created', 0, 'reused', 0),
    'classes', jsonb_build_object('created', 0, 'reused', 0),
    'disciplinas', jsonb_build_object('created', 0, 'reused', 0),
    'curso_matriz', jsonb_build_object('created', 0),
    'turmas', jsonb_build_object('created', 0, 'skipped', 0),
    'turma_disciplinas', jsonb_build_object('created', 0)
  );
  v_actor_id uuid := auth.uid();
  v_ano_letivo_id uuid;
  v_ano_letivo int;
  curso_group record;
  matrix_row jsonb;
  disciplina_blueprint record;
  v_curso_id uuid;
  v_classe_id uuid;
  v_disciplina_id uuid;
  v_turma_id uuid;
  v_escola_id uuid := public.current_tenant_escola_id();
  v_has_permission boolean;
  letras text[] := ARRAY['A','B','C','D','E','F','G','H','I','J'];
BEGIN
  IF v_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;
  SELECT public.user_has_role_in_school(v_escola_id, ARRAY['admin', 'admin_escola'])
  INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  v_ano_letivo := p_session_id::int;
  SELECT id INTO v_ano_letivo_id FROM public.anos_letivos WHERE escola_id = v_escola_id AND ano = v_ano_letivo;
  IF v_ano_letivo_id IS NULL THEN
    RAISE EXCEPTION 'Ano letivo % não encontrado para a escola %.', v_ano_letivo, p_escola_id;
  END IF;

  FOR curso_group IN
    SELECT
      (arr.item->>'cursoKey') as curso_key,
      (arr.item->>'cursoNome') as curso_nome,
      jsonb_agg(arr.item) as rows
    FROM jsonb_array_elements(p_matrix) WITH ORDINALITY AS arr(item, position)
    GROUP BY curso_key, curso_nome
  LOOP
    INSERT INTO public.cursos (escola_id, nome, codigo, status_aprovacao)
    VALUES (v_escola_id, curso_group.curso_nome, curso_group.curso_key, 'aprovado')
    ON CONFLICT (escola_id, codigo) DO UPDATE SET nome = EXCLUDED.nome
    RETURNING id INTO v_curso_id;

    IF (SELECT xmax FROM pg_class WHERE relname = 'cursos') = 0 THEN
      v_summary := jsonb_set(v_summary, '{cursos,created}', (v_summary->'cursos'->>'created')::int + 1);
    ELSE
      v_summary := jsonb_set(v_summary, '{cursos,reused}', (v_summary->'cursos'->>'reused')::int + 1);
    END IF;

    INSERT INTO public.curso_curriculos (escola_id, curso_id, ano_letivo_id, status, version, created_by)
    VALUES (v_escola_id, v_curso_id, v_ano_letivo_id, 'draft', (
      SELECT COALESCE(MAX(version), 0) + 1 FROM public.curso_curriculos
      WHERE escola_id = v_escola_id AND curso_id = v_curso_id AND ano_letivo_id = v_ano_letivo_id
    ), v_actor_id)
    ON CONFLICT (escola_id, curso_id, ano_letivo_id, version) DO NOTHING;

    FOR matrix_row IN SELECT * FROM jsonb_array_elements(curso_group.rows) LOOP
      INSERT INTO public.classes (escola_id, curso_id, nome)
      VALUES (v_escola_id, v_curso_id, matrix_row->>'nome')
      ON CONFLICT (escola_id, curso_id, nome) DO UPDATE SET nome = EXCLUDED.nome
      RETURNING id INTO v_classe_id;

      IF (SELECT xmax FROM pg_class WHERE relname = 'classes') = 0 THEN
        v_summary := jsonb_set(v_summary, '{classes,created}', (v_summary->'classes'->>'created')::int + 1);
      ELSE
        v_summary := jsonb_set(v_summary, '{classes,reused}', (v_summary->'classes'->>'reused')::int + 1);
      END IF;

      FOR i IN 1..(matrix_row->>'manha')::int LOOP
        INSERT INTO public.turmas (escola_id, curso_id, classe_id, ano_letivo, ano_letivo_id, nome, turno, status_validacao)
        VALUES (v_escola_id, v_curso_id, v_classe_id, v_ano_letivo, v_ano_letivo_id, letras[i], 'M', 'ativo')
        ON CONFLICT (escola_id, curso_id, classe_id, ano_letivo, nome, turno) DO NOTHING;
      END LOOP;
      FOR i IN 1..(matrix_row->>'tarde')::int LOOP
        INSERT INTO public.turmas (escola_id, curso_id, classe_id, ano_letivo, ano_letivo_id, nome, turno, status_validacao)
        VALUES (v_escola_id, v_curso_id, v_classe_id, v_ano_letivo, v_ano_letivo_id, letras[i], 'T', 'ativo')
        ON CONFLICT (escola_id, curso_id, classe_id, ano_letivo, nome, turno) DO NOTHING;
      END LOOP;
      FOR i IN 1..(matrix_row->>'noite')::int LOOP
        INSERT INTO public.turmas (escola_id, curso_id, classe_id, ano_letivo, ano_letivo_id, nome, turno, status_validacao)
        VALUES (v_escola_id, v_curso_id, v_classe_id, v_ano_letivo, v_ano_letivo_id, letras[i], 'N', 'ativo')
        ON CONFLICT (escola_id, curso_id, classe_id, ano_letivo, nome, turno) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, portal, details)
  VALUES (
    v_escola_id,
    v_actor_id,
    'ONBOARDING_ACADEMIC_STRUCTURE',
    'multiple',
    'admin',
    jsonb_build_object(
      'summary', v_summary,
      'ano_letivo', v_ano_letivo
    )
  );

  RETURN v_summary;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_frequencias_batch(
  p_escola_id uuid,
  p_turma_id uuid,
  p_disciplina_id uuid,
  p_data date,
  p_presencas jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aula_id uuid;
  v_turma_disciplina_id uuid;
  v_periodo_letivo_id uuid;
  v_actor_id uuid := auth.uid();
  presenca_record jsonb;
  v_matricula_id uuid;
  v_status text;
  v_inserted boolean;
  v_inserted_count int := 0;
  v_updated_count int := 0;
  v_escola_id uuid := public.current_tenant_escola_id();
  v_has_permission boolean;
BEGIN
  IF v_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;
  SELECT public.user_has_role_in_school(v_escola_id, ARRAY['professor', 'admin', 'admin_escola'])
  INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  SELECT td.id INTO v_turma_disciplina_id
  FROM public.turma_disciplinas td
  JOIN public.curso_matriz cm ON cm.id = td.curso_matriz_id
  WHERE td.escola_id = v_escola_id
    AND td.turma_id = p_turma_id
    AND cm.disciplina_id = p_disciplina_id
  ORDER BY td.created_at DESC
  LIMIT 1;

  IF v_turma_disciplina_id IS NULL THEN
    RAISE EXCEPTION 'Turma/Disciplina não encontrada para frequência';
  END IF;

  SELECT pl.id INTO v_periodo_letivo_id
  FROM public.periodos_letivos pl
  JOIN public.anos_letivos al ON al.id = pl.ano_letivo_id
  WHERE al.escola_id = v_escola_id
    AND p_data BETWEEN pl.data_inicio AND pl.data_fim
  ORDER BY pl.data_inicio DESC
  LIMIT 1;

  SELECT a.id INTO v_aula_id
  FROM public.aulas a
  WHERE a.escola_id = v_escola_id
    AND a.turma_disciplina_id = v_turma_disciplina_id
    AND a.data = p_data;

  IF v_aula_id IS NULL THEN
    INSERT INTO public.aulas (escola_id, turma_disciplina_id, data, created_by)
    VALUES (v_escola_id, v_turma_disciplina_id, p_data, v_actor_id)
    RETURNING id INTO v_aula_id;
  END IF;

  FOR presenca_record IN SELECT * FROM jsonb_array_elements(p_presencas) LOOP
    v_matricula_id := (
      SELECT m.id FROM public.matriculas m
      WHERE m.escola_id = v_escola_id
        AND m.turma_id = p_turma_id
        AND m.aluno_id = (presenca_record->>'aluno_id')::uuid
        AND m.status = 'ativa'
      LIMIT 1
    );
    v_status := presenca_record->>'status';

    IF v_matricula_id IS NOT NULL THEN
      INSERT INTO public.frequencias (escola_id, matricula_id, data, aula_id, status, periodo_letivo_id)
      VALUES (v_escola_id, v_matricula_id, p_data, v_aula_id, v_status, v_periodo_letivo_id)
      ON CONFLICT (escola_id, matricula_id, data, aula_id) DO UPDATE
        SET status = EXCLUDED.status, updated_at = now()
      RETURNING (xmax = 0) INTO v_inserted;

      IF v_inserted THEN
        v_inserted_count := v_inserted_count + 1;
      ELSE
        v_updated_count := v_updated_count + 1;
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, portal, details)
  VALUES (
    v_escola_id,
    v_actor_id,
    'FREQUENCIA_UPSERT_BATCH',
    'frequencias',
    'professor',
    jsonb_build_object(
      'aula_id', v_aula_id,
      'turma_id', p_turma_id,
      'disciplina_id', p_disciplina_id,
      'data', p_data,
      'inserted_count', v_inserted_count,
      'updated_count', v_updated_count
    )
  );

  RETURN jsonb_build_object('ok', true, 'inserted', v_inserted_count, 'updated', v_updated_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.fechar_periodo_academico(
  p_escola_id uuid,
  p_turma_id uuid,
  p_periodo_letivo_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_escola_id uuid := public.current_tenant_escola_id();
  v_has_permission boolean;
BEGIN
  IF v_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;
  SELECT public.user_has_role_in_school(v_escola_id, ARRAY['admin', 'admin_escola'])
  INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  INSERT INTO public.frequencia_status_periodo (
    escola_id, turma_id, periodo_letivo_id, aluno_id, matricula_id,
    aulas_previstas, presencas, faltas, atrasos, percentual_presenca,
    frequencia_min_percent, abaixo_minimo, updated_at
  )
  SELECT
    escola_id, turma_id, periodo_letivo_id, aluno_id, matricula_id,
    aulas_previstas, presencas, faltas, atrasos, percentual_presenca,
    frequencia_min_percent, abaixo_minimo, now()
  FROM public.frequencia_resumo_periodo(p_turma_id, p_periodo_letivo_id)
  ON CONFLICT (escola_id, turma_id, periodo_letivo_id, aluno_id)
  DO UPDATE SET
    aulas_previstas = EXCLUDED.aulas_previstas,
    presencas = EXCLUDED.presencas,
    faltas = EXCLUDED.faltas,
    atrasos = EXCLUDED.atrasos,
    percentual_presenca = EXCLUDED.percentual_presenca,
    frequencia_min_percent = EXCLUDED.frequencia_min_percent,
    abaixo_minimo = EXCLUDED.abaixo_minimo,
    updated_at = now();

  UPDATE public.periodos_letivos
  SET trava_notas_em = now()
  WHERE id = p_periodo_letivo_id AND escola_id = v_escola_id;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    v_escola_id,
    v_actor_id,
    'FECHAMENTO_PERIODO',
    'periodos_letivos',
    p_periodo_letivo_id::text,
    'admin',
    jsonb_build_object(
      'turma_id', p_turma_id,
      'periodo_letivo_id', p_periodo_letivo_id,
      'action_comment', 'Período fechado para frequências e notas.'
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gerar_historico_anual(
  p_matricula_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_matricula record;
  v_historico_ano_id uuid;
  boletim_row record;
  v_escola_id uuid := public.current_tenant_escola_id();
  v_has_permission boolean;
BEGIN
  IF v_escola_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: escola_id não resolvido.';
  END IF;

  SELECT * INTO v_matricula FROM public.matriculas WHERE id = p_matricula_id AND escola_id = v_escola_id;
  IF v_matricula.id IS NULL THEN
    RAISE EXCEPTION 'Matrícula com ID % não encontrada.', p_matricula_id;
  END IF;

  SELECT public.user_has_role_in_school(v_escola_id, ARRAY['secretaria', 'admin', 'admin_escola'])
  INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  INSERT INTO public.historico_anos (escola_id, aluno_id, ano_letivo, turma_id, status_final)
  VALUES (
    v_matricula.escola_id,
    v_matricula.aluno_id,
    v_matricula.ano_letivo,
    v_matricula.turma_id,
    v_matricula.status
  )
  ON CONFLICT (escola_id, aluno_id, ano_letivo) DO UPDATE SET
    turma_id = EXCLUDED.turma_id,
    status_final = EXCLUDED.status_final,
    updated_at = now()
  RETURNING id INTO v_historico_ano_id;

  FOR boletim_row IN
    SELECT *
    FROM public.vw_boletim_por_matricula
    WHERE matricula_id = p_matricula_id
  LOOP
    INSERT INTO public.historico_disciplinas (
      historico_ano_id,
      disciplina_id,
      disciplina_nome,
      nota_final,
      status_final,
      notas_detalhe
    )
    VALUES (
      v_historico_ano_id,
      boletim_row.disciplina_id,
      boletim_row.disciplina_nome,
      boletim_row.nota_final,
      CASE
        WHEN boletim_row.nota_final >= 9.5 THEN 'aprovado'
        ELSE 'reprovado'
      END,
      boletim_row.notas_por_tipo
    )
    ON CONFLICT (historico_ano_id, disciplina_id) DO UPDATE SET
      disciplina_nome = EXCLUDED.disciplina_nome,
      nota_final = EXCLUDED.nota_final,
      status_final = EXCLUDED.status_final,
      notas_detalhe = EXCLUDED.notas_detalhe,
      updated_at = now();
  END LOOP;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    v_matricula.escola_id,
    auth.uid(),
    'HISTORICO_ANUAL_GERADO',
    'historico_anos',
    v_historico_ano_id::text,
    'system',
    jsonb_build_object(
      'matricula_id', p_matricula_id,
      'status_final_matricula', v_matricula.status
    )
  );

  RETURN v_historico_ano_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.emitir_documento_final(
  p_escola_id uuid,
  p_aluno_id uuid,
  p_ano_letivo int,
  p_tipo_documento text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_has_permission boolean;
  v_historico_ano record;
  v_aluno record;
  v_turma record;
  v_documento_emitido record;
  v_numero_sequencial int;
  v_hash_validacao text;
  v_snapshot jsonb;
  v_escola_id uuid := public.current_tenant_escola_id();
BEGIN
  IF v_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  SELECT public.user_has_role_in_school(v_escola_id, ARRAY['secretaria', 'admin', 'admin_escola'])
  INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  SELECT * INTO v_historico_ano FROM public.historico_anos
  WHERE escola_id = v_escola_id AND aluno_id = p_aluno_id AND ano_letivo = p_ano_letivo;

  IF v_historico_ano.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Histórico para o ano letivo % não encontrado para este aluno. O ano precisa ser finalizado primeiro.', p_ano_letivo;
  END IF;

  SELECT nome, bi_numero INTO v_aluno FROM public.alunos WHERE id = p_aluno_id;
  SELECT nome, turno INTO v_turma FROM public.turmas WHERE id = v_historico_ano.turma_id;

  SELECT public.next_documento_numero(v_escola_id) INTO v_numero_sequencial;
  v_hash_validacao := encode(sha256(random()::text::bytea), 'hex');

  v_snapshot := jsonb_build_object(
    'aluno_id', p_aluno_id,
    'aluno_nome', v_aluno.nome,
    'aluno_bi', v_aluno.bi_numero,
    'matricula_id', v_historico_ano.matricula_id,
    'turma_id', v_historico_ano.turma_id,
    'turma_nome', v_turma.nome,
    'turma_turno', v_turma.turno,
    'ano_letivo', v_historico_ano.ano_letivo,
    'status_final', v_historico_ano.status_final,
    'tipo_documento', p_tipo_documento,
    'numero_sequencial', v_numero_sequencial,
    'hash_validacao', v_hash_validacao
  );

  INSERT INTO public.documentos_emitidos
    (escola_id, aluno_id, numero_sequencial, tipo, dados_snapshot, created_by, hash_validacao)
  VALUES
    (v_escola_id, p_aluno_id, v_numero_sequencial, p_tipo_documento, v_snapshot, v_actor_id, v_hash_validacao)
  RETURNING * INTO v_documento_emitido;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    v_escola_id,
    v_actor_id,
    'DOCUMENTO_FINAL_EMITIDO',
    'documentos_emitidos',
    v_documento_emitido.id::text,
    'secretaria',
    v_snapshot
  );

  RETURN jsonb_build_object(
    'ok', true,
    'docId', v_documento_emitido.id,
    'publicId', v_documento_emitido.public_id,
    'hash', v_documento_emitido.hash_validacao,
    'tipo', v_documento_emitido.tipo
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.finalizar_matricula_anual(
  p_escola_id uuid,
  p_matricula_id uuid,
  p_novo_status text,
  p_motivo text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_has_permission boolean;
  v_matricula record;
  v_canonical_status text;
  v_missing_grades_count int;
  v_escola_id uuid := public.current_tenant_escola_id();
BEGIN
  IF v_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;
  SELECT public.user_has_role_in_school(v_escola_id, ARRAY['secretaria', 'admin', 'admin_escola'])
  INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  SELECT * INTO v_matricula FROM public.matriculas WHERE id = p_matricula_id AND escola_id = v_escola_id FOR UPDATE;
  IF v_matricula.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Matrícula não encontrada.';
  END IF;

  v_canonical_status := public.canonicalize_matricula_status_text(p_novo_status);
  IF v_canonical_status NOT IN ('concluido', 'reprovado', 'transferido', 'inativo') THEN
    RAISE EXCEPTION 'LOGIC: Status final inválido. Use concluido, reprovado, transferido ou inativo.';
  END IF;

  IF v_canonical_status = 'concluido' THEN
    SELECT SUM(b.missing_count) INTO v_missing_grades_count
    FROM public.vw_boletim_por_matricula b
    WHERE b.matricula_id = p_matricula_id;

    IF v_missing_grades_count > 0 THEN
      RAISE EXCEPTION 'LOGIC: Não é possível concluir a matrícula. Existem % notas em falta.', v_missing_grades_count;
    END IF;
  END IF;

  UPDATE public.matriculas
  SET status = v_canonical_status, updated_at = now()
  WHERE id = p_matricula_id;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details, before, after)
  VALUES (
    v_escola_id,
    v_actor_id,
    'MATRICULA_STATUS_FINALIZADO',
    'matriculas',
    p_matricula_id::text,
    'secretaria',
    jsonb_build_object('motivo', p_motivo),
    jsonb_build_object('status', v_matricula.status),
    jsonb_build_object('status', v_canonical_status)
  );

  IF v_canonical_status IN ('concluido', 'reprovado') THEN
    PERFORM public.gerar_historico_anual(p_matricula_id);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_mv_boletim_por_matricula()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_boletim_por_matricula;
END;
$$;

COMMIT;
