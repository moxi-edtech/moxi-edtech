-- Migration: restore_current_tenant_escola_fallbacks
-- Purpose: Restore robust resolution of current_tenant_escola_id() so RLS
--          policies keep working even when the JWT lacks an explicit
--          escola_id claim. Falls back to app_metadata, profile bindings
--          and escola_usuarios membership before returning NULL.

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
  -- Claims directly from the request (Supabase injects these for auth users)
  begin
    v_claims := current_setting('request.jwt.claims', true)::jsonb;
  exception when others then
    v_claims := '{}'::jsonb;
  end;

  -- 1) Prefer explicit top-level claim
  if (v_claims ? 'escola_id') then
    v_escola := nullif(v_claims->>'escola_id', '')::uuid;
    if v_escola is not null then
      return v_escola;
    end if;
  end if;

  -- 2) Fallback to app_metadata.escola_id (common custom-claim pattern)
  if (v_claims ? 'app_metadata') and ((v_claims->'app_metadata') ? 'escola_id') then
    v_escola := nullif((v_claims->'app_metadata')->>'escola_id', '')::uuid;
    if v_escola is not null then
      return v_escola;
    end if;
  end if;

  -- 3) Preferred school from profile (current_escola_id > escola_id)
  begin
    select coalesce(p.current_escola_id, p.escola_id)::uuid
      into v_profile_escola
    from public.profiles p
    where p.user_id = auth.uid()
    order by p.created_at desc
    limit 1;
  exception when others then
    v_profile_escola := null;
  end;

  -- 4a) Validate profile school against escola_usuarios membership
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

  -- 4b) Otherwise take the first escola_usuarios link
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

  -- 5) Last resort: trust the profile preference alone
  if v_profile_escola is not null then
    return v_profile_escola;
  end if;

  return null;
end;
$$;

grant execute on function public.current_tenant_escola_id() to authenticated;
