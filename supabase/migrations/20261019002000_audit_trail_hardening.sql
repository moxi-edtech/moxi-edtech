CREATE OR REPLACE FUNCTION public.audit_dml_trigger() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_temp'
    AS $$
declare
  v_escola_id uuid;
  v_entity_id text;
  v_details jsonb;
  v_portal text;
  v_action text;
  v_entity text := tg_table_name;
begin
  v_action := case tg_op when 'INSERT' then 'CREATE' when 'UPDATE' then 'UPDATE' when 'DELETE' then 'DELETE' end;
  v_portal := case tg_table_name when 'pagamentos' then 'financeiro' when 'matriculas' then 'secretaria' else 'outro' end;

  if tg_op = 'INSERT' then
    begin v_escola_id := (new).escola_id; exception when others then v_escola_id := null; end;
    begin v_entity_id := (new).id::text; exception when others then v_entity_id := null; end;
    v_details := jsonb_build_object('op', tg_op, 'new', to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    begin v_escola_id := (new).escola_id; exception when others then v_escola_id := null; end;
    begin v_entity_id := (new).id::text; exception when others then v_entity_id := null; end;
    v_details := jsonb_build_object('op', tg_op, 'old', to_jsonb(old), 'new', to_jsonb(new));
  else
    begin v_escola_id := (old).escola_id; exception when others then v_escola_id := null; end;
    begin v_entity_id := (old).id::text; exception when others then v_entity_id := null; end;
    v_details := jsonb_build_object('op', tg_op, 'old', to_jsonb(old));
  end if;

  insert into public.audit_logs (escola_id, user_id, portal, action, entity, entity_id, details)
  values (v_escola_id, auth.uid(), v_portal, v_action, v_entity, v_entity_id, v_details);

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'financeiro_cobrancas'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_financeiro_cobrancas') THEN
      CREATE TRIGGER trg_audit_financeiro_cobrancas
      AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_cobrancas
      FOR EACH ROW EXECUTE FUNCTION public.audit_dml_trigger();
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'financeiro_estornos'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_financeiro_estornos') THEN
      CREATE TRIGGER trg_audit_financeiro_estornos
      AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_estornos
      FOR EACH ROW EXECUTE FUNCTION public.audit_dml_trigger();
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'financeiro_lancamentos'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_financeiro_lancamentos') THEN
      CREATE TRIGGER trg_audit_financeiro_lancamentos
      AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_lancamentos
      FOR EACH ROW EXECUTE FUNCTION public.audit_dml_trigger();
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'financeiro_titulos'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_financeiro_titulos') THEN
      CREATE TRIGGER trg_audit_financeiro_titulos
      AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_titulos
      FOR EACH ROW EXECUTE FUNCTION public.audit_dml_trigger();
    END IF;
  END IF;
END $$;
