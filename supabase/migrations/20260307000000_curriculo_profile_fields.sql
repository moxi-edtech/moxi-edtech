BEGIN;

ALTER TABLE public.curso_matriz
  ADD COLUMN IF NOT EXISTS carga_horaria_semanal integer,
  ADD COLUMN IF NOT EXISTS classificacao text,
  ADD COLUMN IF NOT EXISTS periodos_ativos integer[],
  ADD COLUMN IF NOT EXISTS entra_no_horario boolean,
  ADD COLUMN IF NOT EXISTS avaliacao_mode text,
  ADD COLUMN IF NOT EXISTS avaliacao_modelo_id uuid,
  ADD COLUMN IF NOT EXISTS avaliacao_disciplina_id uuid,
  ADD COLUMN IF NOT EXISTS status_completude text DEFAULT 'incompleto';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'curso_matriz_carga_horaria_semanal_check'
  ) THEN
    ALTER TABLE public.curso_matriz
      ADD CONSTRAINT curso_matriz_carga_horaria_semanal_check
      CHECK (carga_horaria_semanal IS NULL OR carga_horaria_semanal > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'curso_matriz_classificacao_check'
  ) THEN
    ALTER TABLE public.curso_matriz
      ADD CONSTRAINT curso_matriz_classificacao_check
      CHECK (classificacao IS NULL OR classificacao IN ('core', 'complementar', 'optativa'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'curso_matriz_periodos_ativos_check'
  ) THEN
    ALTER TABLE public.curso_matriz
      ADD CONSTRAINT curso_matriz_periodos_ativos_check
      CHECK (periodos_ativos IS NULL OR periodos_ativos <@ ARRAY[1,2,3]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'curso_matriz_avaliacao_mode_check'
  ) THEN
    ALTER TABLE public.curso_matriz
      ADD CONSTRAINT curso_matriz_avaliacao_mode_check
      CHECK (avaliacao_mode IS NULL OR avaliacao_mode IN ('inherit_school', 'custom', 'inherit_disciplina'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'curso_matriz_status_completude_check'
  ) THEN
    ALTER TABLE public.curso_matriz
      ADD CONSTRAINT curso_matriz_status_completude_check
      CHECK (status_completude IS NULL OR status_completude IN ('completo', 'incompleto'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'curso_matriz_avaliacao_modelo_fk'
  ) THEN
    ALTER TABLE public.curso_matriz
      ADD CONSTRAINT curso_matriz_avaliacao_modelo_fk
      FOREIGN KEY (avaliacao_modelo_id)
      REFERENCES public.modelos_avaliacao(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'curso_matriz_avaliacao_disciplina_fk'
  ) THEN
    ALTER TABLE public.curso_matriz
      ADD CONSTRAINT curso_matriz_avaliacao_disciplina_fk
      FOREIGN KEY (avaliacao_disciplina_id)
      REFERENCES public.disciplinas_catalogo(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

ALTER TABLE public.turma_disciplinas
  ADD COLUMN IF NOT EXISTS carga_horaria_semanal integer,
  ADD COLUMN IF NOT EXISTS classificacao text,
  ADD COLUMN IF NOT EXISTS periodos_ativos integer[],
  ADD COLUMN IF NOT EXISTS entra_no_horario boolean,
  ADD COLUMN IF NOT EXISTS avaliacao_mode text,
  ADD COLUMN IF NOT EXISTS avaliacao_disciplina_id uuid;

DROP FUNCTION IF EXISTS public.curriculo_publish(uuid, uuid, uuid, integer, boolean);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'turma_disciplinas_periodos_ativos_check'
  ) THEN
    ALTER TABLE public.turma_disciplinas
      ADD CONSTRAINT turma_disciplinas_periodos_ativos_check
      CHECK (periodos_ativos IS NULL OR periodos_ativos <@ ARRAY[1,2,3]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'turma_disciplinas_classificacao_check'
  ) THEN
    ALTER TABLE public.turma_disciplinas
      ADD CONSTRAINT turma_disciplinas_classificacao_check
      CHECK (classificacao IS NULL OR classificacao IN ('core', 'complementar', 'optativa'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'turma_disciplinas_avaliacao_mode_check'
  ) THEN
    ALTER TABLE public.turma_disciplinas
      ADD CONSTRAINT turma_disciplinas_avaliacao_mode_check
      CHECK (avaliacao_mode IS NULL OR avaliacao_mode IN ('inherit_school', 'custom', 'inherit_disciplina'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'turma_disciplinas_avaliacao_disciplina_fk'
  ) THEN
    ALTER TABLE public.turma_disciplinas
      ADD CONSTRAINT turma_disciplinas_avaliacao_disciplina_fk
      FOREIGN KEY (avaliacao_disciplina_id)
      REFERENCES public.disciplinas_catalogo(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

DROP POLICY IF EXISTS curso_matriz_delete ON public.curso_matriz;
CREATE POLICY curso_matriz_delete
  ON public.curso_matriz
  FOR DELETE
  TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola','admin'])
  );

DROP POLICY IF EXISTS turma_disciplinas_delete ON public.turma_disciplinas;
CREATE POLICY turma_disciplinas_delete
  ON public.turma_disciplinas
  FOR DELETE
  TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola','admin'])
  );

CREATE OR REPLACE FUNCTION public.curriculo_publish(
  p_escola_id uuid,
  p_curso_id uuid,
  p_ano_letivo_id uuid,
  p_version integer,
  p_rebuild_turmas boolean DEFAULT true
)
RETURNS TABLE (
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
BEGIN
  if p_escola_id is distinct from v_escola_id then
    null;
  end if;

  if not public.user_has_role_in_school(v_escola_id, array['admin_escola']) then
    raise exception 'permission denied: admin_escola required';
  end if;

  if p_version is null or p_version < 1 then
    raise exception 'invalid version';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      v_escola_id::text || ':' || p_curso_id::text || ':' || p_ano_letivo_id::text,
      0
    )
  );

  select cc.id into v_target_id
  from public.curso_curriculos cc
  where cc.escola_id = v_escola_id
    and cc.curso_id = p_curso_id
    and cc.ano_letivo_id = p_ano_letivo_id
    and cc.version = p_version
  limit 1;

  if v_target_id is null then
    return query
    select false, 'target curriculum version not found', null::uuid, null::uuid, '[]'::jsonb, 0;
    return;
  end if;

  if exists (
    select 1 from public.curso_curriculos
    where id = v_target_id
      and status = 'published'
  ) then
    return query
    select true, 'already published (idempotent)', v_target_id, null::uuid, '[]'::jsonb, 0;
    return;
  end if;

  select not exists (
    select 1 from public.curso_matriz cm
    where cm.escola_id = v_escola_id
      and cm.curso_curriculo_id = v_target_id
  ) into v_empty_curriculo;

  if v_empty_curriculo then
    return query
    select false, 'curriculo sem disciplinas', null::uuid, null::uuid, '[]'::jsonb, 0;
    return;
  end if;

  with pendencias_base as (
    select
      cm.id as curso_matriz_id,
      cm.disciplina_id,
      cm.classe_id,
      array_remove(array[
        case when cm.carga_horaria_semanal is null or cm.carga_horaria_semanal <= 0 then 'carga_horaria_semanal' end,
        case when cm.classificacao is null then 'classificacao' end,
        case when cm.periodos_ativos is null or array_length(cm.periodos_ativos, 1) = 0 then 'periodos_ativos' end,
        case when cm.entra_no_horario is null then 'entra_no_horario' end,
        case when cm.avaliacao_mode is null then 'avaliacao_mode' end,
        case when cm.avaliacao_mode = 'custom' and cm.avaliacao_modelo_id is null then 'avaliacao_modelo_id' end,
        case when cm.avaliacao_mode = 'inherit_disciplina' and cm.avaliacao_disciplina_id is null then 'avaliacao_disciplina_id' end,
        case when cm.avaliacao_mode = 'custom'
              and cm.avaliacao_modelo_id is not null
              and public.sum_component_pesos(ma.componentes) <> 100 then 'avaliacao_pesos' end
      ], null) as pendencias
    from public.curso_matriz cm
    left join public.modelos_avaliacao ma
      on ma.id = cm.avaliacao_modelo_id
    where cm.escola_id = v_escola_id
      and cm.curso_curriculo_id = v_target_id
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'curso_matriz_id', curso_matriz_id,
      'disciplina_id', disciplina_id,
      'classe_id', classe_id,
      'pendencias', pendencias
    )) filter (where array_length(pendencias, 1) > 0), '[]'::jsonb),
    coalesce(count(*) filter (where array_length(pendencias, 1) > 0), 0)
  into v_pendencias, v_pendencias_count
  from pendencias_base;

  if v_pendencias_count > 0 then
    return query
    select false, 'curriculo pendente: metadados obrigatorios ausentes', null::uuid, null::uuid, v_pendencias, v_pendencias_count;
    return;
  end if;

  select exists (
    select 1
      from public.classes cl
      join public.curso_matriz cm
        on cm.classe_id = cl.id
     where cm.escola_id = v_escola_id
       and cm.curso_curriculo_id = v_target_id
       and cl.carga_horaria_semanal is not null
     group by cl.id, cl.carga_horaria_semanal
    having sum(coalesce(cm.carga_horaria_semanal, 0)) > cl.carga_horaria_semanal
  ) into v_overload;

  if v_overload then
    return query
    select false, 'carga horaria acima do permitido na classe', null::uuid, null::uuid, '[]'::jsonb, 0;
    return;
  end if;

  select exists (
    select 1
      from public.classes cl
      join public.curso_matriz cm
        on cm.classe_id = cl.id
     where cm.escola_id = v_escola_id
       and cm.curso_curriculo_id = v_target_id
       and cl.min_disciplinas_core is not null
     group by cl.id, cl.min_disciplinas_core
    having count(*) filter (where cm.classificacao = 'core') < cl.min_disciplinas_core
  ) into v_core_short;

  if v_core_short then
    return query
    select false, 'disciplinas core abaixo do minimo', null::uuid, null::uuid, '[]'::jsonb, 0;
    return;
  end if;

  select cc.id into v_prev_id
  from public.curso_curriculos cc
  where cc.escola_id = v_escola_id
    and cc.curso_id = p_curso_id
    and cc.ano_letivo_id = p_ano_letivo_id
    and cc.status = 'published'
  order by cc.version desc
  limit 1;

  if v_prev_id is not null then
    update public.curso_curriculos
      set status = 'archived'
    where id = v_prev_id;
  end if;

  update public.curso_curriculos
    set status = 'published'
  where id = v_target_id;

  if p_rebuild_turmas then
    perform public.curriculo_rebuild_turma_disciplinas(v_escola_id, p_curso_id, p_ano_letivo_id);
  end if;

  return query
  select true,
         'published successfully',
         v_target_id,
         v_prev_id,
         '[]'::jsonb,
         0;
exception
  when unique_violation then
    select cc.id into v_prev_id
    from public.curso_curriculos cc
    where cc.escola_id = v_escola_id
      and cc.curso_id = p_curso_id
      and cc.ano_letivo_id = p_ano_letivo_id
      and cc.status = 'published'
    order by cc.version desc
    limit 1;

    if v_prev_id = v_target_id then
      return query select true, 'published concurrently (idempotent)', v_target_id, null::uuid, '[]'::jsonb, 0;
    end if;

    return query select false, 'conflict: another version is published', v_prev_id, null::uuid, '[]'::jsonb, 0;
end;
$$;

CREATE OR REPLACE FUNCTION public.curriculo_rebuild_turma_disciplinas(
  p_escola_id uuid,
  p_curso_id uuid,
  p_ano_letivo_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_default_modelo uuid;
BEGIN
  select id
    into v_default_modelo
    from public.modelos_avaliacao
   where escola_id = p_escola_id
     and is_default = true
   order by updated_at desc
   limit 1;

  with curr as (
    select cc.id
    from public.curso_curriculos cc
    where cc.escola_id = p_escola_id
      and cc.curso_id = p_curso_id
      and cc.ano_letivo_id = p_ano_letivo_id
      and cc.status = 'published'
    order by cc.version desc
    limit 1
  )
  delete from public.turma_disciplinas td
  using public.turmas t
  where td.escola_id = p_escola_id
    and t.id = td.turma_id
    and t.escola_id = p_escola_id
    and t.curso_id = p_curso_id
    and t.ano_letivo_id = p_ano_letivo_id;

  insert into public.turma_disciplinas (
    id,
    escola_id,
    turma_id,
    disciplina_id,
    curso_matriz_id,
    modelo_avaliacao_id,
    carga_horaria_semanal,
    classificacao,
    periodos_ativos,
    entra_no_horario,
    avaliacao_mode,
    avaliacao_disciplina_id,
    created_at
  )
  select
    gen_random_uuid(),
    t.escola_id,
    t.id,
    cm.disciplina_id,
    cm.id,
    case
      when cm.avaliacao_mode = 'custom' then cm.avaliacao_modelo_id
      when cm.avaliacao_mode = 'inherit_school' then v_default_modelo
      else null
    end,
    cm.carga_horaria_semanal,
    cm.classificacao,
    cm.periodos_ativos,
    cm.entra_no_horario,
    cm.avaliacao_mode,
    cm.avaliacao_disciplina_id,
    now()
  from public.turmas t
  join curr on true
  join public.curso_matriz cm
    on cm.escola_id = p_escola_id
   and cm.curso_curriculo_id = curr.id
   and cm.classe_id = t.classe_id
  where t.escola_id = p_escola_id
    and t.curso_id = p_curso_id
    and t.ano_letivo_id = p_ano_letivo_id;
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
  v_existing_audit bigint;
  v_existing_details jsonb;
  v_default_modelo uuid;
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

  select id
    into v_default_modelo
    from public.modelos_avaliacao
   where escola_id = p_escola_id
     and is_default = true
   order by updated_at desc
   limit 1;

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
            SELECT
              cm.id,
              cm.disciplina_id,
              cm.classe_id,
              cm.carga_horaria_semanal,
              cm.classificacao,
              cm.periodos_ativos,
              cm.entra_no_horario,
              cm.avaliacao_mode,
              cm.avaliacao_modelo_id,
              cm.avaliacao_disciplina_id
            FROM public.curso_matriz cm
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
              carga_horaria_semanal,
              classificacao,
              periodos_ativos,
              entra_no_horario,
              avaliacao_mode,
              avaliacao_disciplina_id
            )
            VALUES (
              p_escola_id,
              v_turma_id,
              v_curso_matriz_item.id,
              null,
              case
                when v_curso_matriz_item.avaliacao_mode = 'custom' then v_curso_matriz_item.avaliacao_modelo_id
                when v_curso_matriz_item.avaliacao_mode = 'inherit_school' then v_default_modelo
                else null
              end,
              v_curso_matriz_item.carga_horaria_semanal,
              v_curso_matriz_item.classificacao,
              v_curso_matriz_item.periodos_ativos,
              v_curso_matriz_item.entra_no_horario,
              v_curso_matriz_item.avaliacao_mode,
              v_curso_matriz_item.avaliacao_disciplina_id
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
                SELECT
                  cm.id,
                  cm.disciplina_id,
                  cm.classe_id,
                  cm.carga_horaria_semanal,
                  cm.classificacao,
                  cm.periodos_ativos,
                  cm.entra_no_horario,
                  cm.avaliacao_mode,
                  cm.avaliacao_modelo_id,
                  cm.avaliacao_disciplina_id
                FROM public.curso_matriz cm
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
                  carga_horaria_semanal,
                  classificacao,
                  periodos_ativos,
                  entra_no_horario,
                  avaliacao_mode,
                  avaliacao_disciplina_id
                )
                VALUES (
                  p_escola_id,
                  v_turma_id,
                  v_curso_matriz_item.id,
                  null,
                  case
                    when v_curso_matriz_item.avaliacao_mode = 'custom' then v_curso_matriz_item.avaliacao_modelo_id
                    when v_curso_matriz_item.avaliacao_mode = 'inherit_school' then v_default_modelo
                    else null
                  end,
                  v_curso_matriz_item.carga_horaria_semanal,
                  v_curso_matriz_item.classificacao,
                  v_curso_matriz_item.periodos_ativos,
                  v_curso_matriz_item.entra_no_horario,
                  v_curso_matriz_item.avaliacao_mode,
                  v_curso_matriz_item.avaliacao_disciplina_id
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

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, before, after, portal, details)
  VALUES (
    p_escola_id,
    v_actor_id,
    'TURMAS_GERADAS_FROM_CURRICULO',
    'turmas',
    null,
    null,
    jsonb_build_object('turmas_geradas', jsonb_build_array()),
    'admin',
    jsonb_build_object(
      'curso_id', p_curso_id,
      'ano_letivo', p_ano_letivo,
      'turmas_count', v_new_turmas_count,
      'turma_disciplinas_count', v_new_turma_disciplinas_count,
      'generation_params', p_generation_params,
      'idempotency_key', p_idempotency_key
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'turmas_criadas', v_new_turmas_count,
    'turma_disciplinas_criadas', v_new_turma_disciplinas_count
  );
END;
$$;

COMMIT;
