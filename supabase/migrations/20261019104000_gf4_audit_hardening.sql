CREATE OR REPLACE FUNCTION public.audit_redact_jsonb(
  p_entity text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  redacted jsonb := p_payload;
BEGIN
  IF redacted IS NULL THEN
    RETURN NULL;
  END IF;

  redacted := redacted
    - 'bi_numero'
    - 'nif'
    - 'email'
    - 'telefone'
    - 'telefone_responsavel'
    - 'encarregado_telefone'
    - 'responsavel_contato'
    - 'encarregado_email'
    - 'numero_processo'
    - 'numero_processo_legado'
    - 'codigo_ativacao'
    - 'usuario_auth_id'
    - 'dados_candidato';

  RETURN redacted;
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
    public.audit_redact_jsonb(p_entity, p_before),
    public.audit_redact_jsonb(p_entity, p_after),
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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'alunos'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_alunos') THEN
      CREATE TRIGGER trg_audit_alunos
      AFTER INSERT OR UPDATE OR DELETE ON public.alunos
      FOR EACH ROW EXECUTE FUNCTION public.audit_dml_trigger();
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'matriculas'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_matriculas') THEN
      CREATE TRIGGER trg_audit_matriculas
      AFTER INSERT OR UPDATE OR DELETE ON public.matriculas
      FOR EACH ROW EXECUTE FUNCTION public.audit_dml_trigger();
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'candidaturas'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_candidaturas') THEN
      CREATE TRIGGER trg_audit_candidaturas
      AFTER INSERT OR UPDATE OR DELETE ON public.candidaturas
      FOR EACH ROW EXECUTE FUNCTION public.audit_dml_trigger();
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'pagamentos'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_pagamentos') THEN
      CREATE TRIGGER trg_audit_pagamentos
      AFTER INSERT OR UPDATE OR DELETE ON public.pagamentos
      FOR EACH ROW EXECUTE FUNCTION public.audit_dml_trigger();
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'profiles'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_profiles') THEN
      CREATE TRIGGER trg_audit_profiles
      AFTER INSERT OR UPDATE OR DELETE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.audit_dml_trigger();
    END IF;
  END IF;
END $$;
