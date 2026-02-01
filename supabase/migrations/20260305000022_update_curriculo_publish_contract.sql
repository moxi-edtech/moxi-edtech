BEGIN;

CREATE OR REPLACE FUNCTION public.curriculo_publish(
  p_escola_id uuid,
  p_curso_id uuid,
  p_ano_letivo_id uuid,
  p_version integer,
  p_rebuild_turmas boolean DEFAULT true
)
RETURNS TABLE (ok boolean, message text, published_curriculo_id uuid, previous_published_curriculo_id uuid)
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $$
DECLARE
  v_escola_id uuid := public.current_tenant_escola_id();
  v_target_id uuid;
  v_prev_id uuid;
  v_missing_model integer := 0;
  v_missing_carga integer := 0;
  v_empty_curriculo boolean := false;
  v_overload boolean := false;
  v_core_short boolean := false;
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
    select false, 'target curriculum version not found', null::uuid, null::uuid;
    return;
  end if;

  if exists (
    select 1 from public.curso_curriculos
    where id = v_target_id
      and status = 'published'
  ) then
    return query
    select true, 'already published (idempotent)', v_target_id, null::uuid;
    return;
  end if;

  select not exists (
    select 1 from public.curso_matriz cm
    where cm.escola_id = v_escola_id
      and cm.curso_curriculo_id = v_target_id
  ) into v_empty_curriculo;

  if v_empty_curriculo then
    raise exception 'curriculo sem disciplinas';
  end if;

  select count(*)::int
    into v_missing_model
    from public.curso_matriz cm
    join public.disciplinas_catalogo dc
      on dc.id = cm.disciplina_id
   where cm.escola_id = v_escola_id
     and cm.curso_curriculo_id = v_target_id
     and coalesce(dc.is_avaliavel, true)
     and dc.aplica_modelo_avaliacao_id is null;

  if v_missing_model > 0 then
    raise exception 'disciplinas sem modelo de avaliacao';
  end if;

  select count(*)::int
    into v_missing_carga
    from public.curso_matriz cm
    join public.disciplinas_catalogo dc
      on dc.id = cm.disciplina_id
   where cm.escola_id = v_escola_id
     and cm.curso_curriculo_id = v_target_id
     and (dc.carga_horaria_semana is null or dc.carga_horaria_semana <= 0);

  if v_missing_carga > 0 then
    raise exception 'disciplinas sem carga horaria semanal';
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
    having sum(coalesce(cm.carga_horaria, 0)) > cl.carga_horaria_semanal
  ) into v_overload;

  if v_overload then
    raise exception 'carga horaria acima do permitido na classe';
  end if;

  select exists (
    select 1
      from public.classes cl
      join public.curso_matriz cm
        on cm.classe_id = cl.id
      join public.disciplinas_catalogo dc
        on dc.id = cm.disciplina_id
     where cm.escola_id = v_escola_id
       and cm.curso_curriculo_id = v_target_id
       and cl.min_disciplinas_core is not null
     group by cl.id, cl.min_disciplinas_core
    having count(*) filter (where dc.is_core) < cl.min_disciplinas_core
  ) into v_core_short;

  if v_core_short then
    raise exception 'disciplinas core abaixo do minimo';
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
         v_prev_id;
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
      return query select true, 'published concurrently (idempotent)', v_target_id, null::uuid;
    end if;

    return query select false, 'conflict: another version is published', v_prev_id, null::uuid;
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
BEGIN
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
    created_at
  )
  select
    gen_random_uuid(),
    t.escola_id,
    t.id,
    cm.disciplina_id,
    cm.id,
    dc.aplica_modelo_avaliacao_id,
    now()
  from public.turmas t
  join curr on true
  join public.curso_matriz cm
    on cm.escola_id = p_escola_id
   and cm.curso_curriculo_id = curr.id
   and cm.classe_id = t.classe_id
  join public.disciplinas_catalogo dc
    on dc.id = cm.disciplina_id
  where t.escola_id = p_escola_id
    and t.curso_id = p_curso_id
    and t.ano_letivo_id = p_ano_letivo_id;
END;
$$;

COMMIT;
