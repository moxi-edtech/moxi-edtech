-- Harden audit DML trigger execution for authenticated business mutations.
-- The trigger writes to audit_logs from mutations such as pagamentos; execute it as
-- postgres-owned SECURITY DEFINER so audit capture is not blocked by the caller's
-- RLS/table/function privileges.

BEGIN;

CREATE OR REPLACE FUNCTION public.audit_dml_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
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
  v_action := CASE tg_op
    WHEN 'INSERT' THEN 'CREATE'
    WHEN 'UPDATE' THEN 'UPDATE'
    WHEN 'DELETE' THEN 'DELETE'
  END;

  v_portal := CASE tg_table_name
    WHEN 'pagamentos' THEN 'financeiro'
    WHEN 'matriculas' THEN 'secretaria'
    ELSE 'outro'
  END;

  IF tg_op = 'INSERT' THEN
    BEGIN v_escola_id := (new).escola_id; EXCEPTION WHEN others THEN v_escola_id := NULL; END;
    BEGIN v_entity_id := (new).id::text; EXCEPTION WHEN others THEN v_entity_id := NULL; END;
    v_before := NULL;
    v_after := public.audit_redact_jsonb(v_entity, to_jsonb(new));
  ELSIF tg_op = 'UPDATE' THEN
    BEGIN v_escola_id := (new).escola_id; EXCEPTION WHEN others THEN v_escola_id := NULL; END;
    BEGIN v_entity_id := (new).id::text; EXCEPTION WHEN others THEN v_entity_id := NULL; END;
    v_before := public.audit_redact_jsonb(v_entity, to_jsonb(old));
    v_after := public.audit_redact_jsonb(v_entity, to_jsonb(new));
  ELSE
    BEGIN v_escola_id := (old).escola_id; EXCEPTION WHEN others THEN v_escola_id := NULL; END;
    BEGIN v_entity_id := (old).id::text; EXCEPTION WHEN others THEN v_entity_id := NULL; END;
    v_before := public.audit_redact_jsonb(v_entity, to_jsonb(old));
    v_after := NULL;
  END IF;

  IF v_escola_id IS NULL THEN
    IF tg_op = 'DELETE' THEN
      RETURN old;
    END IF;
    RETURN new;
  END IF;

  ctx := COALESCE(public.audit_request_context(), '{}'::jsonb);
  v_actor_id := public.safe_auth_uid();

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

  IF tg_op = 'DELETE' THEN
    RETURN old;
  END IF;
  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_dml_trigger() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_dml_trigger() TO postgres, service_role;

COMMIT;
