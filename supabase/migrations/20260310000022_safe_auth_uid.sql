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
  IF v_sub IS NULL THEN
    BEGIN
      v_sub := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub';
    EXCEPTION WHEN others THEN
      v_sub := null;
    END;
  END IF;

  BEGIN
    RETURN v_sub::uuid;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_dml_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_temp'
AS $$
DECLARE
  v_escola_id uuid;
  v_entity_id text;
  v_portal text;
  v_action text;
  v_entity text := tg_table_name;
  v_before jsonb;
  v_after jsonb;
  ctx jsonb;
  v_actor_id uuid;
BEGIN
  v_action := case tg_op when 'INSERT' then 'CREATE' when 'UPDATE' then 'UPDATE' when 'DELETE' then 'DELETE' end;
  v_portal := case tg_table_name when 'pagamentos' then 'financeiro' when 'matriculas' then 'secretaria' else 'outro' end;

  if tg_op = 'INSERT' then
    begin v_escola_id := (new).escola_id; exception when others then v_escola_id := null; end;
    begin v_entity_id := (new).id::text; exception when others then v_entity_id := null; end;
    v_before := null;
    v_after := public.audit_redact_jsonb(v_entity, to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    begin v_escola_id := (new).escola_id; exception when others then v_escola_id := null; end;
    begin v_entity_id := (new).id::text; exception when others then v_entity_id := null; end;
    v_before := public.audit_redact_jsonb(v_entity, to_jsonb(old));
    v_after := public.audit_redact_jsonb(v_entity, to_jsonb(new));
  else
    begin v_escola_id := (old).escola_id; exception when others then v_escola_id := null; end;
    begin v_entity_id := (old).id::text; exception when others then v_entity_id := null; end;
    v_before := public.audit_redact_jsonb(v_entity, to_jsonb(old));
    v_after := null;
  end if;

  if v_escola_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  ctx := public.audit_request_context();
  v_actor_id := public.safe_auth_uid();

  insert into public.audit_logs (
    escola_id,
    actor_id,
    actor_role,
    user_id,
    portal,
    action,
    entity,
    entity_id,
    details,
    before,
    after,
    ip,
    user_agent
  ) values (
    v_escola_id,
    v_actor_id,
    ctx->>'actor_role',
    v_actor_id,
    v_portal,
    v_action,
    v_entity,
    v_entity_id,
    jsonb_build_object('op', tg_op),
    v_before,
    v_after,
    ctx->>'ip',
    ctx->>'user_agent'
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

COMMIT;
