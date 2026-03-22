BEGIN;

CREATE OR REPLACE FUNCTION public.current_tenant_escola_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_claims jsonb := '{}'::jsonb;
  v_escola uuid := null;
  v_profile_escola uuid := null;
  v_uid uuid := public.safe_auth_uid();
BEGIN
  begin
    v_claims := current_setting('request.jwt.claims', true)::jsonb;
  exception when others then
    v_claims := '{}'::jsonb;
  end;

  if (v_claims ? 'escola_id') then
    begin
      v_escola := nullif(v_claims->>'escola_id', '')::uuid;
    exception when others then
      v_escola := null;
    end;
    if v_escola is not null then
      return v_escola;
    end if;
  end if;

  if (v_claims ? 'app_metadata') and ((v_claims->'app_metadata') ? 'escola_id') then
    begin
      v_escola := nullif((v_claims->'app_metadata')->>'escola_id', '')::uuid;
    exception when others then
      v_escola := null;
    end;
    if v_escola is not null then
      return v_escola;
    end if;
  end if;

  if v_uid is not null then
    begin
      select coalesce(p.current_escola_id, p.escola_id)::uuid
        into v_profile_escola
      from public.profiles p
      where p.user_id = v_uid
      order by p.created_at desc
      limit 1;
    exception when others then
      v_profile_escola := null;
    end;

    if v_profile_escola is not null then
      begin
        select eu.escola_id::uuid
          into v_escola
        from public.escola_usuarios eu
        where eu.user_id = v_uid
          and eu.escola_id = v_profile_escola
        order by eu.created_at nulls first
        limit 1;
      exception when others then
        v_escola := null;
      end;

      if v_escola is not null then
        return v_escola;
      end if;

      begin
        select eu.escola_id::uuid
          into v_escola
        from public.escola_users eu
        where eu.user_id = v_uid
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

    begin
      select eu.escola_id::uuid
        into v_escola
      from public.escola_usuarios eu
      where eu.user_id = v_uid
      order by eu.created_at nulls first
      limit 1;
    exception when others then
      v_escola := null;
    end;

    if v_escola is not null then
      return v_escola;
    end if;

    begin
      select eu.escola_id::uuid
        into v_escola
      from public.escola_users eu
      where eu.user_id = v_uid
      order by eu.created_at nulls first
      limit 1;
    exception when others then
      v_escola := null;
    end;

    if v_escola is not null then
      return v_escola;
    end if;
  end if;

  return null;
end;
$$;

COMMIT;
