BEGIN;

ALTER TABLE public.curso_curriculos
  ADD COLUMN IF NOT EXISTS classe_id uuid;

ALTER TABLE public.curso_curriculos
  DISABLE TRIGGER trg_curso_curriculos_force_fields;

WITH base AS (
  SELECT
    cc.id AS old_id,
    cm.escola_id AS escola_id,
    cm.curso_id AS curso_id,
    cc.ano_letivo_id,
    cc.version,
    cc.status,
    cc.created_at,
    cc.created_by,
    cm.classe_id
  FROM public.curso_curriculos cc
  JOIN public.curso_matriz cm
    ON cm.curso_curriculo_id = cc.id
  WHERE cc.classe_id IS NULL
    AND cm.escola_id IS NOT NULL
    AND cm.curso_id IS NOT NULL
    AND cc.ano_letivo_id IS NOT NULL
  GROUP BY cc.id, cm.classe_id, cm.escola_id, cm.curso_id
)
INSERT INTO public.curso_curriculos (
  escola_id,
  curso_id,
  ano_letivo_id,
  version,
  status,
  created_at,
  created_by,
  classe_id
)
SELECT
  base.escola_id,
  base.curso_id,
  base.ano_letivo_id,
  base.version,
  base.status,
  base.created_at,
  base.created_by,
  base.classe_id
FROM base
ON CONFLICT DO NOTHING;

UPDATE public.curso_matriz cm
SET curso_curriculo_id = cc_new.id
FROM public.curso_curriculos cc_old,
     public.curso_curriculos cc_new
WHERE cm.curso_curriculo_id = cc_old.id
  AND cc_old.classe_id IS NULL
  AND cc_new.escola_id = cc_old.escola_id
  AND cc_new.curso_id = cc_old.curso_id
  AND cc_new.ano_letivo_id = cc_old.ano_letivo_id
  AND cc_new.version = cc_old.version
  AND cc_new.status = cc_old.status
  AND cc_new.classe_id = cm.classe_id;

DELETE FROM public.curso_curriculos cc
WHERE cc.classe_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.curso_matriz cm
    WHERE cm.curso_curriculo_id = cc.id
  );

ALTER TABLE public.curso_curriculos
  ENABLE TRIGGER trg_curso_curriculos_force_fields;

ALTER TABLE public.curso_curriculos
  DROP CONSTRAINT IF EXISTS curso_curriculos_escola_curso_ano_version_uk;

DROP INDEX IF EXISTS public.curso_curriculos_one_published_per_year_ux;
DROP INDEX IF EXISTS public.curso_curriculos_lookup_idx;

CREATE UNIQUE INDEX curso_curriculos_escola_curso_classe_ano_version_uk
  ON public.curso_curriculos (escola_id, curso_id, classe_id, ano_letivo_id, version);

CREATE UNIQUE INDEX curso_curriculos_one_published_per_class_ux
  ON public.curso_curriculos (escola_id, curso_id, classe_id, ano_letivo_id)
  WHERE status = 'published'::public.curriculo_status;

CREATE INDEX curso_curriculos_lookup_idx
  ON public.curso_curriculos (escola_id, curso_id, classe_id, ano_letivo_id, status, version DESC);

CREATE OR REPLACE FUNCTION public.curriculo_rebuild_turma_disciplinas(
  p_escola_id uuid,
  p_curso_id uuid,
  p_ano_letivo_id uuid,
  p_classe_id uuid DEFAULT NULL
) RETURNS void
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
    select cc.id, cc.classe_id
      from public.curso_curriculos cc
     where cc.escola_id = p_escola_id
       and cc.curso_id = p_curso_id
       and cc.ano_letivo_id = p_ano_letivo_id
       and cc.status = 'published'
       and (p_classe_id is null or cc.classe_id = p_classe_id)
  )
  delete from public.turma_disciplinas td
  using public.turmas t
  where td.escola_id = p_escola_id
    and t.id = td.turma_id
    and t.escola_id = p_escola_id
    and t.curso_id = p_curso_id
    and t.ano_letivo_id = p_ano_letivo_id
    and (p_classe_id is null or t.classe_id = p_classe_id);

  insert into public.turma_disciplinas (
    id,
    escola_id,
    turma_id,
    curso_matriz_id,
    professor_id,
    carga_horaria_semanal,
    classificacao,
    entra_no_horario,
    periodos_ativos,
    avaliacao_mode,
    avaliacao_disciplina_id,
    modelo_avaliacao_id
  )
  select
    gen_random_uuid(),
    t.escola_id,
    t.id,
    cm.id,
    null,
    cm.carga_horaria_semanal,
    cm.classificacao,
    cm.entra_no_horario,
    cm.periodos_ativos,
    coalesce(cm.avaliacao_mode, 'inherit_school'),
    cm.avaliacao_disciplina_id,
    coalesce(cm.avaliacao_modelo_id, v_default_modelo)
  from public.turmas t
  join curr on true
  join public.curso_matriz cm
    on cm.curso_curriculo_id = curr.id
   and cm.classe_id = curr.classe_id
  where t.escola_id = p_escola_id
    and t.curso_id = p_curso_id
    and t.ano_letivo_id = p_ano_letivo_id
    and t.classe_id = curr.classe_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.curriculo_publish_single(
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
      v_escola_id::text || ':' || p_curso_id::text || ':' || p_ano_letivo_id::text || ':' || p_classe_id::text,
      0
    )
  );

  select cc.id into v_target_id
  from public.curso_curriculos cc
  where cc.escola_id = v_escola_id
    and cc.curso_id = p_curso_id
    and cc.ano_letivo_id = p_ano_letivo_id
    and cc.version = p_version
    and cc.classe_id = p_classe_id
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

  select cc.id into v_prev_id
  from public.curso_curriculos cc
  where cc.escola_id = v_escola_id
    and cc.curso_id = p_curso_id
    and cc.ano_letivo_id = p_ano_letivo_id
    and cc.status = 'published'
    and cc.classe_id = p_classe_id
  order by cc.version desc
  limit 1;

  select not exists (
    select 1 from public.curso_matriz cm
    where cm.escola_id = v_escola_id
      and cm.curso_curriculo_id = v_target_id
      and cm.classe_id = p_classe_id
  ) into v_empty_curriculo;

  if v_empty_curriculo and v_prev_id is not null then
    insert into public.curso_matriz (
      escola_id,
      curso_id,
      classe_id,
      disciplina_id,
      carga_horaria,
      obrigatoria,
      ordem,
      ativo,
      curso_curriculo_id,
      carga_horaria_semanal,
      classificacao,
      periodos_ativos,
      entra_no_horario,
      avaliacao_mode,
      avaliacao_modelo_id,
      avaliacao_disciplina_id,
      status_completude,
      status_horario,
      status_avaliacao
    )
    select
      cm.escola_id,
      cm.curso_id,
      cm.classe_id,
      cm.disciplina_id,
      cm.carga_horaria,
      cm.obrigatoria,
      cm.ordem,
      cm.ativo,
      v_target_id,
      cm.carga_horaria_semanal,
      cm.classificacao,
      cm.periodos_ativos,
      cm.entra_no_horario,
      cm.avaliacao_mode,
      cm.avaliacao_modelo_id,
      cm.avaliacao_disciplina_id,
      cm.status_completude,
      cm.status_horario,
      cm.status_avaliacao
    from public.curso_matriz cm
    where cm.escola_id = v_escola_id
      and cm.curso_curriculo_id = v_prev_id
      and cm.classe_id = p_classe_id
    on conflict do nothing;
    get diagnostics v_rows = row_count;
    if v_rows > 0 then
      v_empty_curriculo := false;
    end if;
  end if;

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
      ], null) as pendencias_value
    from public.curso_matriz cm
    left join public.modelos_avaliacao ma
      on ma.id = cm.avaliacao_modelo_id
    where cm.escola_id = v_escola_id
      and cm.curso_curriculo_id = v_target_id
      and cm.classe_id = p_classe_id
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'curso_matriz_id', curso_matriz_id,
      'disciplina_id', disciplina_id,
      'classe_id', classe_id,
      'pendencias', pendencias_value
    )) filter (where array_length(pendencias_value, 1) > 0), '[]'::jsonb),
    coalesce(count(*) filter (where array_length(pendencias_value, 1) > 0), 0)
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
       and cm.classe_id = p_classe_id
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
       and cm.classe_id = p_classe_id
       and cl.min_disciplinas_core is not null
     group by cl.id, cl.min_disciplinas_core
    having count(*) filter (where cm.classificacao = 'core') < cl.min_disciplinas_core
  ) into v_core_short;

  if v_core_short then
    return query
    select false, 'disciplinas core abaixo do minimo', null::uuid, null::uuid, '[]'::jsonb, 0;
    return;
  end if;

  if v_prev_id is not null then
    update public.curso_curriculos
      set status = 'archived'
    where id = v_prev_id;
  end if;

  update public.curso_curriculos
    set status = 'published'
  where id = v_target_id;

  if p_rebuild_turmas then
    perform public.curriculo_rebuild_turma_disciplinas(v_escola_id, p_curso_id, p_ano_letivo_id, p_classe_id);
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
      and cc.classe_id = p_classe_id
    order by cc.version desc
    limit 1;

    if v_prev_id = v_target_id then
      return query select true, 'published concurrently (idempotent)', v_target_id, null::uuid, '[]'::jsonb, 0;
    end if;

    return query select false, 'conflict: another version is published', v_prev_id, null::uuid, '[]'::jsonb, 0;
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
  v_last_published uuid := null;
BEGIN
  if p_classe_id is not null then
    return query
      select * from public.curriculo_publish_single(
        p_escola_id,
        p_curso_id,
        p_ano_letivo_id,
        p_version,
        p_rebuild_turmas,
        p_classe_id
      );
    return;
  end if;

  for v_row in
    select distinct cc.classe_id
      from public.curso_curriculos cc
     where cc.escola_id = p_escola_id
       and cc.curso_id = p_curso_id
       and cc.ano_letivo_id = p_ano_letivo_id
       and cc.version = p_version
       and cc.classe_id is not null
  loop
    select *
      into v_row
      from public.curriculo_publish_single(
        p_escola_id,
        p_curso_id,
        p_ano_letivo_id,
        p_version,
        p_rebuild_turmas,
        v_row.classe_id
      );

    if not v_row.ok then
      v_ok := false;
      v_message := v_row.message;
    else
      v_last_published := v_row.published_curriculo_id;
    end if;
  end loop;

  return query
    select v_ok, v_message, v_last_published, null::uuid, '[]'::jsonb, 0;
END;
$$;

COMMIT;
