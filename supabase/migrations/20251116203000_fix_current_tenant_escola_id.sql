-- Migration: fix_current_tenant_escola_id
-- Purpose: Make current_tenant_escola_id() robust and consistent by:
--  1) Using JWT escola_id when present
--  2) Falling back to escola_usuarios (ground truth de vínculo)
--  3) Usando profiles apenas como último recurso

create or replace function public.current_tenant_escola_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_claims jsonb := '{}'::jsonb;
  v_escola uuid := null;
  v_profile_escola uuid := null;
begin
  -- Try to read claims from request context (Supabase injects this)
  begin
    v_claims := current_setting('request.jwt.claims', true)::jsonb;
  exception when others then
    v_claims := '{}'::jsonb;
  end;

  -- 1) Direct top-level claim: escola_id
  if (v_claims ? 'escola_id') then
    v_escola := nullif(v_claims->>'escola_id', '')::uuid;
    if v_escola is not null then
      return v_escola;
    end if;
  end if;

  -- 2) app_metadata.escola_id (common pattern for custom claims)
  if (v_claims ? 'app_metadata') and ((v_claims->'app_metadata') ? 'escola_id') then
    v_escola := nullif((v_claims->'app_metadata')->>'escola_id', '')::uuid;
    if v_escola is not null then
      return v_escola;
    end if;
  end if;

  -- 3) Tentar obter escola "preferida" via profile (mas ainda não confiar cegamente)
  begin
    select coalesce(p.current_escola_id, p.escola_id)::uuid
      into v_profile_escola
    from public.profiles p
    where p.user_id = auth.uid()
    limit 1;
  exception when others then
    v_profile_escola := null;
  end;

  -- 4) Ground truth: escola_usuarios
  -- 4a) Se o profile aponta para alguma escola, tentar validar contra escola_usuarios
  if v_profile_escola is not null then
    begin
      select eu.escola_id::uuid
        into v_escola
      from public.escola_usuarios eu
      where eu.user_id = auth.uid()
        and eu.escola_id = v_profile_escola
      order by eu.created_at nulls first
      limit 1;
    exception when others then
      v_escola := null;
    end;

    if v_escola is not null then
      return v_escola;
    end if;
  end if;

  -- 4b) Se não bateu com o profile, pegar o primeiro vínculo em escola_usuarios
  begin
    select eu.escola_id::uuid
      into v_escola
    from public.escola_usuarios eu
    where eu.user_id = auth.uid()
    order by eu.created_at nulls first
    limit 1;
  exception when others then
    v_escola := null;
  end;

  if v_escola is not null then
    return v_escola;
  end if;

  -- 5) Último fallback: usar apenas o profile (em cenários legados/transitórios)
  if v_profile_escola is not null then
    return v_profile_escola;
  end if;

  -- Sem escola resolvida → RLS deve negar
  return null;
end;
$$;

grant execute on function public.current_tenant_escola_id() to authenticated;
