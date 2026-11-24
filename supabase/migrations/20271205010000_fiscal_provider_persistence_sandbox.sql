BEGIN;

-- Foundation only. No production connection can be activated by this migration.
CREATE TABLE public.fiscal_provider_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.fiscal_empresas(id) ON DELETE RESTRICT,
  provider_code text NOT NULL CHECK (provider_code IN ('mock','ulemo','vero','native')),
  environment text NOT NULL CHECK (environment IN ('sandbox','production')),
  status text NOT NULL DEFAULT 'disabled' CHECK (status IN ('disabled','active')),
  external_company_id text CHECK (external_company_id IS NULL OR btrim(external_company_id) <> ''),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id,id),
  CHECK (status = 'disabled' OR (environment = 'sandbox' AND provider_code = 'mock'))
);
CREATE UNIQUE INDEX fiscal_provider_one_active_per_environment
  ON public.fiscal_provider_connections (empresa_id,environment) WHERE status = 'active';

-- The immutable request IS the outbox entry, avoiding a second queue that can drift.
-- Only sandbox mock work is admitted; worker and production state transitions are later gates.
CREATE TABLE public.fiscal_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  connection_id uuid NOT NULL,
  source_kind text NOT NULL CHECK (char_length(source_kind) BETWEEN 1 AND 64 AND source_kind = btrim(source_kind)),
  source_id uuid NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('FT','FR','RC','NC','ND')),
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 1 AND 200 AND idempotency_key = btrim(idempotency_key)),
  request_payload jsonb NOT NULL CHECK (jsonb_typeof(request_payload) = 'object'),
  status text NOT NULL DEFAULT 'queued' CHECK (status = 'queued'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (empresa_id,connection_id) REFERENCES public.fiscal_provider_connections(empresa_id,id) ON DELETE RESTRICT,
  UNIQUE (empresa_id,idempotency_key),
  UNIQUE (empresa_id,source_kind,source_id,document_type),
  UNIQUE (empresa_id,connection_id,id)
);
CREATE INDEX fiscal_operations_queued_idx ON public.fiscal_operations(created_at,id) WHERE status = 'queued';

-- Connection identity is pinned for the lifetime of historical references.
CREATE FUNCTION public.fiscal_provider_connection_identity_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
  IF (NEW.id,NEW.empresa_id,NEW.provider_code,NEW.environment,NEW.external_company_id,NEW.created_at)
     IS DISTINCT FROM (OLD.id,OLD.empresa_id,OLD.provider_code,OLD.environment,OLD.external_company_id,OLD.created_at) THEN
    RAISE EXCEPTION 'FISCAL_CONNECTION_IDENTITY_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER fiscal_provider_connection_identity_guard BEFORE UPDATE ON public.fiscal_provider_connections
FOR EACH ROW EXECUTE FUNCTION public.fiscal_provider_connection_identity_guard();

CREATE FUNCTION public.fiscal_provider_operation_admission_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
  PERFORM 1 FROM public.fiscal_provider_connections c
  WHERE c.empresa_id = NEW.empresa_id AND c.id = NEW.connection_id
    AND c.status = 'active' AND c.environment = 'sandbox' AND c.provider_code = 'mock'
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FISCAL_SANDBOX_CONNECTION_REQUIRED' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER fiscal_provider_operation_admission_guard BEFORE INSERT ON public.fiscal_operations
FOR EACH ROW EXECUTE FUNCTION public.fiscal_provider_operation_admission_guard();

-- Replay returns the existing operation only if both identities and the exact JSONB
-- snapshot match. Unique constraints are across connections: switching provider cannot duplicate work.
CREATE FUNCTION public.fiscal_provider_enqueue_sandbox(
  p_empresa_id uuid, p_connection_id uuid, p_source_kind text, p_source_id uuid,
  p_document_type text, p_idempotency_key text, p_request_payload jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE
  v_operation public.fiscal_operations%ROWTYPE;
  v_id uuid;
BEGIN
  SELECT * INTO v_operation FROM public.fiscal_operations o
  WHERE o.empresa_id = p_empresa_id AND o.idempotency_key = p_idempotency_key;
  IF NOT FOUND THEN
    INSERT INTO public.fiscal_operations(empresa_id,connection_id,source_kind,source_id,document_type,idempotency_key,request_payload)
    VALUES (p_empresa_id,p_connection_id,p_source_kind,p_source_id,p_document_type,p_idempotency_key,p_request_payload)
    ON CONFLICT DO NOTHING RETURNING id INTO v_id;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
    SELECT * INTO v_operation FROM public.fiscal_operations o
    WHERE o.empresa_id = p_empresa_id AND o.idempotency_key = p_idempotency_key;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'FISCAL_SOURCE_CONFLICT' USING ERRCODE = '23505';
    END IF;
  END IF;
  IF (v_operation.connection_id,v_operation.source_kind,v_operation.source_id,v_operation.document_type,v_operation.request_payload)
     IS DISTINCT FROM (p_connection_id,p_source_kind,p_source_id,p_document_type,p_request_payload) THEN
    RAISE EXCEPTION 'FISCAL_IDEMPOTENCY_CONFLICT' USING ERRCODE = '23505';
  END IF;
  RETURN v_operation.id;
END;
$$;

-- No provider secret or external response payload is exposed to school users.
-- Later projections may grant narrowly scoped reads; these base tables are private to backend.
ALTER TABLE public.fiscal_provider_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fiscal_provider_connections, public.fiscal_operations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.fiscal_provider_connections, public.fiscal_operations TO service_role;
GRANT UPDATE(status) ON public.fiscal_provider_connections TO service_role;
-- Row-locking SELECT FOR SHARE requires UPDATE privilege on at least one connection column.
REVOKE ALL ON FUNCTION public.fiscal_provider_enqueue_sandbox(uuid,uuid,text,uuid,text,text,jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fiscal_provider_enqueue_sandbox(uuid,uuid,text,uuid,text,text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.fiscal_provider_connection_identity_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fiscal_provider_operation_admission_guard() FROM PUBLIC, anon, authenticated;
-- Explicit trigger execution grants for the backend (no definer privileges).
GRANT EXECUTE ON FUNCTION public.fiscal_provider_connection_identity_guard() TO service_role;
GRANT EXECUTE ON FUNCTION public.fiscal_provider_operation_admission_guard() TO service_role;

COMMIT;
