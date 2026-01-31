BEGIN;

-- =========================================================
-- ADICIONA AUDITORIA À FUNÇÃO curriculo_publish
-- =========================================================

CREATE OR REPLACE FUNCTION public.curriculo_publish("p_escola_id" "uuid", "p_curso_id" "uuid", "p_ano_letivo_id" "uuid", "p_version" integer, "p_rebuild_turmas" boolean DEFAULT true) RETURNS TABLE("ok" boolean, "message" "text", "published_curriculo_id" "uuid", "previous_published_curriculo_id" "uuid")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public', 'extensions'
    AS $$
declare
  v_escola_id uuid := public.current_tenant_escola_id();
  v_target_id uuid;
  v_prev_id uuid;
  v_actor_id uuid := auth.uid(); -- Obtém o ID do ator para auditoria
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
    -- Log de tentativa de publicação de currículo não encontrado
    INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, before, after, portal, details)
    VALUES (
      v_escola_id,
      v_actor_id,
      'CURRICULUM_PUBLISH_FAILED',
      'curso_curriculos',
      null, -- Nenhum ID de entidade específico, pois não foi encontrado
      null,
      null,
      'admin',
      jsonb_build_object('message', 'Target curriculum version not found', 'curso_id', p_curso_id, 'ano_letivo_id', p_ano_letivo_id, 'version', p_version)
    );

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
    -- Log de tentativa idempotente (já publicado)
    INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, before, after, portal, details)
    VALUES (
      v_escola_id,
      v_actor_id,
      'CURRICULUM_PUBLISH_IDEMPOTENT',
      'curso_curriculos',
      v_target_id::text,
      null, -- Nenhuma mudança real no registro
      null,
      'admin',
      jsonb_build_object('message', 'Attempted to publish an already published curriculum', 'curso_id', p_curso_id, 'ano_letivo_id', p_ano_letivo_id, 'version', p_version)
    );

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
  --    - despublica anterior (vira archived)
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

  -- 9) TRILHA DE AUDITORIA para publicação bem-sucedida
  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, before, after, portal, details)
  VALUES (
    v_escola_id,
    v_actor_id,
    'CURRICULUM_PUBLISH',
    'curso_curriculos',
    v_target_id::text,
    to_jsonb(jsonb_build_object('previous_published_curriculo_id', v_prev_id)), -- Log ID do currículo anterior
    to_jsonb(jsonb_build_object('published_curriculo_id', v_target_id, 'version', p_version)), -- Log ID e versão do novo publicado
    'admin',
    jsonb_build_object('curso_id', p_curso_id, 'ano_letivo_id', p_ano_letivo_id)
  );

  return query
  select true,
         'published successfully',
         v_target_id,
         v_prev_id;
end;
$$;

COMMIT;
