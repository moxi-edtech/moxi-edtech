begin;

-- ============================================================
-- Helper: rebuild turma_disciplinas para um curso/ano
-- (ajusta conforme seu schema de turmas e turma_disciplinas)
-- ============================================================
create or replace function public.curriculo_rebuild_turma_disciplinas(
  p_escola_id uuid,
  p_curso_id uuid,
  p_ano_letivo_id uuid
)
returns void
language plpgsql
as $$
begin
  /*
    Suposições (ajuste se seus nomes divergem):
    - turmas: (id, escola_id, curso_id, ano_letivo_id, classe_id, ...)
    - turma_disciplinas: (id, escola_id, turma_id, disciplina_id, curso_matriz_id?, professor_id?, ...)
    - curso_matriz: (id, escola_id, curso_id, classe_id, disciplina_id, curso_curriculo_id, ativo, ...)
    Estratégia:
      - Remove turma_disciplinas do conjunto alvo (apenas turmas do curso+ano)
      - Reinsere a partir do currículo published atual (curso_curriculos + curso_matriz)
      - Mantém professor_id NULL (atribuição é outra feature)
  */

  -- 1) Descobrir currículo publicado atual
  --    (garante determinismo)
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
  -- 2) Limpar turma_disciplinas das turmas alvo
  delete from public.turma_disciplinas td
  using public.turmas t
  where td.escola_id = p_escola_id
    and t.id = td.turma_id
    and t.escola_id = p_escola_id
    and t.curso_id = p_curso_id
    and t.ano_letivo_id = p_ano_letivo_id;

  -- 3) Recriar turma_disciplinas a partir do currículo published
  insert into public.turma_disciplinas (
    id,
    escola_id,
    turma_id,
    disciplina_id,
    curso_matriz_id,
    created_at
    -- professor_id fica null
  )
  select
    gen_random_uuid(),
    p_escola_id,
    t.id as turma_id,
    cm.disciplina_id,
    cm.id as curso_matriz_id,
    now()
  from public.turmas t
  join curr on true
  join public.curso_matriz cm
    on cm.escola_id = p_escola_id
   and cm.curso_id = p_curso_id
   and cm.curso_curriculo_id = curr.id
   and cm.classe_id = t.classe_id
   and cm.ativo = true
  where t.escola_id = p_escola_id
    and t.curso_id = p_curso_id
    and t.ano_letivo_id = p_ano_letivo_id
  on conflict do nothing;

end;
$$;

-- ============================================================
-- RPC: curriculo_publish (idempotente, tenant-safe, atomic)
-- ============================================================
create or replace function public.curriculo_publish(
  p_escola_id uuid,
  p_curso_id uuid,
  p_ano_letivo_id uuid,
  p_version integer,
  p_rebuild_turmas boolean default true
)
returns table (
  ok boolean,
  message text,
  published_curriculo_id uuid,
  previous_published_curriculo_id uuid
)
language plpgsql
security invoker
as $$
declare
  v_escola_id uuid := public.current_tenant_escola_id();
  v_target_id uuid;
  v_prev_id uuid;
begin
  -- 0) Tenant hardening: ignora p_escola_id externo
  if p_escola_id is distinct from v_escola_id then
    -- não falha, só ignora (anti-spoof). Se quiser, pode raise exception.
    null;
  end if;

  -- 1) AuthZ: só admin_escola pode publicar
  if not public.user_has_role_in_school(v_escola_id, array['admin_escola']) then
    raise exception 'permission denied: admin_escola required';
  end if;

  -- 2) Valida inputs
  if p_version is null or p_version < 1 then
    raise exception 'invalid version';
  end if;

  -- 3) Lock lógico por grupo (evita corrida de publish concorrente)
  --    hashtextextended é bom p/ advisory lock
  perform pg_advisory_xact_lock(
    hashtextextended(
      v_escola_id::text || ':' || p_curso_id::text || ':' || p_ano_letivo_id::text,
      0
    )
  );

  -- 4) Carregar alvo
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

  -- 5) Se já está published -> idempotente
  if exists (
    select 1 from public.curso_curriculos
    where id = v_target_id
      and status = 'published'
  ) then
    return query
    select true, 'already published (idempotent)', v_target_id, null::uuid;
    return;
  end if;

  -- 6) Descobrir anterior published (se houver)
  select cc.id into v_prev_id
  from public.curso_curriculos cc
  where cc.escola_id = v_escola_id
    and cc.curso_id = p_curso_id
    and cc.ano_letivo_id = p_ano_letivo_id
    and cc.status = 'published'
  order by cc.version desc
  limit 1;

  -- 7) Publicar atomicamente:
  --    - despublica anterior (vira archived ou draft? vou usar archived)
  --    - publica alvo
  if v_prev_id is not null then
    update public.curso_curriculos
      set status = 'archived'
    where id = v_prev_id;
  end if;

  update public.curso_curriculos
    set status = 'published'
  where id = v_target_id;

  -- 8) Rebuild turma_disciplinas (opcional, mas recomendado no piloto)
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
    -- se bater no unique partial index de published, resolver de forma idempotente
    -- (alguém publicou ao mesmo tempo)
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

commit;
