ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS actor_role text;

CREATE OR REPLACE FUNCTION public.audit_request_context()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  headers jsonb;
  claims jsonb;
  ip text;
  ua text;
  role text;
BEGIN
  headers := NULL;
  BEGIN
    headers := current_setting('request.headers', true)::jsonb;
  EXCEPTION WHEN others THEN
    headers := NULL;
  END;

  claims := NULL;
  BEGIN
    claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN others THEN
    claims := NULL;
  END;

  ip := COALESCE(headers->>'x-forwarded-for', headers->>'x-real-ip');
  ua := headers->>'user-agent';
  role := COALESCE(claims->>'user_role', claims->>'role');

  RETURN jsonb_build_object('ip', ip, 'user_agent', ua, 'actor_role', role);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_audit_event(
  p_escola_id uuid,
  p_action text,
  p_entity text,
  p_entity_id text,
  p_before jsonb DEFAULT NULL,
  p_after jsonb DEFAULT NULL,
  p_portal text DEFAULT NULL,
  p_details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ctx jsonb;
BEGIN
  ctx := public.audit_request_context();

  INSERT INTO public.audit_logs (
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
  ) VALUES (
    p_escola_id,
    auth.uid(),
    ctx->>'actor_role',
    auth.uid(),
    p_portal,
    p_action,
    p_entity,
    p_entity_id,
    p_details,
    p_before,
    p_after,
    ctx->>'ip',
    ctx->>'user_agent'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_dml_trigger() RETURNS trigger
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
BEGIN
  v_action := case tg_op when 'INSERT' then 'CREATE' when 'UPDATE' then 'UPDATE' when 'DELETE' then 'DELETE' end;
  v_portal := case tg_table_name when 'pagamentos' then 'financeiro' when 'matriculas' then 'secretaria' else 'outro' end;

  if tg_op = 'INSERT' then
    begin v_escola_id := (new).escola_id; exception when others then v_escola_id := null; end;
    begin v_entity_id := (new).id::text; exception when others then v_entity_id := null; end;
    v_before := NULL;
    v_after := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    begin v_escola_id := (new).escola_id; exception when others then v_escola_id := null; end;
    begin v_entity_id := (new).id::text; exception when others then v_entity_id := null; end;
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
  else
    begin v_escola_id := (old).escola_id; exception when others then v_escola_id := null; end;
    begin v_entity_id := (old).id::text; exception when others then v_entity_id := null; end;
    v_before := to_jsonb(old);
    v_after := NULL;
  end if;

  ctx := public.audit_request_context();

  INSERT INTO public.audit_logs (
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
  ) VALUES (
    v_escola_id,
    auth.uid(),
    ctx->>'actor_role',
    auth.uid(),
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
  else
    return new;
  end if;
END;
$$;
