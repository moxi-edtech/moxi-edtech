BEGIN;

CREATE OR REPLACE FUNCTION public.safe_auth_uid()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sub text;
BEGIN
  v_sub := nullif(current_setting('request.jwt.claim.sub', true), '');
  IF v_sub IS NOT NULL THEN
    BEGIN
      RETURN v_sub::uuid;
    EXCEPTION WHEN others THEN
      v_sub := NULL;
    END;
  END IF;

  BEGIN
    v_sub := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub';
    RETURN v_sub::uuid;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_super_admin_role()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := public.safe_auth_uid();
BEGIN
  RETURN public.current_user_role() IN ('super_admin', 'global_admin')
    OR (
      v_uid IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.user_id = v_uid
          AND p.role::text IN ('super_admin', 'global_admin')
      )
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.user_has_role_in_school(
  p_escola_id uuid,
  p_roles text[]
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := public.safe_auth_uid();
BEGIN
  if public.check_super_admin_role() then
    return true;
  end if;

  if v_uid is null then
    return false;
  end if;

  return exists (
    select 1
    from public.escola_users
    where escola_id = p_escola_id
      and user_id = v_uid
      and papel = any(p_roles)
  );
end;
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_escola_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
    v_escola := nullif(v_claims->>'escola_id', '')::uuid;
    if v_escola is not null then
      return v_escola;
    end if;
  end if;

  if (v_claims ? 'app_metadata') and ((v_claims->'app_metadata') ? 'escola_id') then
    v_escola := nullif((v_claims->'app_metadata')->>'escola_id', '')::uuid;
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
