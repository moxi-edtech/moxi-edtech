-- KLASSE: curriculo_publish copia matriz do published para draft vazio
create or replace function public.curriculo_publish(
  p_escola_id uuid,
  p_curso_id uuid,
  p_ano_letivo_id uuid,
  p_version integer,
  p_rebuild_turmas boolean DEFAULT true
)
returns table (
  ok boolean,
  message text,
  published_curriculo_id uuid,
  previous_published_curriculo_id uuid,
  pendencias jsonb,
  pendencias_count integer
)
language plpgsql
set search_path to 'pg_catalog', 'public', 'extensions'
as $$
declare
  v_escola_id uuid := public.current_tenant_escola_id();
  v_target_id uuid;
  v_prev_id uuid;
  v_empty_curriculo boolean := false;
  v_overload boolean := false;
  v_core_short boolean := false;
  v_pendencias jsonb := '[]'::jsonb;
  v_pendencias_count integer := 0;
  v_rows int := 0;
begin
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

  select cc.id into v_prev_id
  from public.curso_curriculos cc
  where cc.escola_id = v_escola_id
    and cc.curso_id = p_curso_id
    and cc.ano_letivo_id = p_ano_letivo_id
    and cc.status = 'published'
  order by cc.version desc
  limit 1;

  select not exists (
    select 1 from public.curso_matriz cm
    where cm.escola_id = v_escola_id
      and cm.curso_curriculo_id = v_target_id
  ) into v_empty_curriculo;

  if v_empty_curriculo and v_prev_id is not null then
    insert into public.curso_matriz (
      escola_id,
      curso_id,
      classe_id,
      disciplina_id,
      preset_subject_id,
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
      cm.preset_subject_id,
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

-- Defaults backend (safety net)
alter table public.curso_matriz
  alter column periodos_ativos set default '{1,2,3}';

alter table public.curso_matriz
  alter column avaliacao_mode set default 'inherit_school';

alter table public.curso_matriz
  alter column classificacao set default 'core';
