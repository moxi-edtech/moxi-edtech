BEGIN;

-- BILL-001/BILL-002: fiscal ledger must not be mutable through normal API roles.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.fiscal_documentos FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.fiscal_documento_itens FROM anon, authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.fiscal_documentos_eventos FROM anon, authenticated;

DROP POLICY IF EXISTS fiscal_documentos_delete ON public.fiscal_documentos;
DROP POLICY IF EXISTS fiscal_documentos_insert ON public.fiscal_documentos;
DROP POLICY IF EXISTS fiscal_documentos_update ON public.fiscal_documentos;

DROP POLICY IF EXISTS fiscal_documento_itens_delete ON public.fiscal_documento_itens;
DROP POLICY IF EXISTS fiscal_documento_itens_insert ON public.fiscal_documento_itens;
DROP POLICY IF EXISTS fiscal_documento_itens_update ON public.fiscal_documento_itens;

DROP POLICY IF EXISTS fiscal_documentos_eventos_delete ON public.fiscal_documentos_eventos;
DROP POLICY IF EXISTS fiscal_documentos_eventos_update ON public.fiscal_documentos_eventos;

CREATE OR REPLACE FUNCTION public.fiscal_block_document_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public'
AS $$
BEGIN
  RAISE EXCEPTION 'IMMUTABILITY: documento fiscal não pode ser apagado';
END;
$$;

DROP TRIGGER IF EXISTS trg_fiscal_documentos_no_delete ON public.fiscal_documentos;
CREATE TRIGGER trg_fiscal_documentos_no_delete
BEFORE DELETE ON public.fiscal_documentos
FOR EACH ROW EXECUTE FUNCTION public.fiscal_block_document_delete();

CREATE OR REPLACE FUNCTION public.fiscal_block_item_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public'
AS $$
BEGIN
  RAISE EXCEPTION 'IMMUTABILITY: item de documento fiscal é append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_fiscal_documento_itens_no_mutation ON public.fiscal_documento_itens;
CREATE TRIGGER trg_fiscal_documento_itens_no_mutation
BEFORE UPDATE OR DELETE ON public.fiscal_documento_itens
FOR EACH ROW EXECUTE FUNCTION public.fiscal_block_item_mutation();

CREATE OR REPLACE FUNCTION public.fiscal_block_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public'
AS $$
BEGIN
  RAISE EXCEPTION 'IMMUTABILITY: evento fiscal é append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_fiscal_documentos_eventos_no_mutation ON public.fiscal_documentos_eventos;
CREATE TRIGGER trg_fiscal_documentos_eventos_no_mutation
BEFORE UPDATE OR DELETE ON public.fiscal_documentos_eventos
FOR EACH ROW EXECUTE FUNCTION public.fiscal_block_event_mutation();

-- BILL-003/BILL-005: series are authority-provisioned and their counter may
-- only advance through the SECURITY DEFINER reservation RPC.
ALTER TABLE public.fiscal_series
  ADD COLUMN IF NOT EXISTS agt_series_code text,
  ADD COLUMN IF NOT EXISTS agt_submission_uuid uuid,
  ADD COLUMN IF NOT EXISTS agt_status text NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS series_year integer,
  ADD COLUMN IF NOT EXISTS establishment_number text,
  ADD COLUMN IF NOT EXISTS series_contingency_indicator text,
  ADD COLUMN IF NOT EXISTS authorized_quantity bigint,
  ADD COLUMN IF NOT EXISTS first_document_no text,
  ADD COLUMN IF NOT EXISTS last_document_no text,
  ADD COLUMN IF NOT EXISTS agt_provisioned_at timestamptz;

ALTER TABLE public.fiscal_series
  DROP CONSTRAINT IF EXISTS fiscal_series_agt_status_chk;
ALTER TABLE public.fiscal_series
  ADD CONSTRAINT fiscal_series_agt_status_chk
  CHECK (agt_status IN ('legacy','pending','provisioned','rejected','retired'));

ALTER TABLE public.fiscal_series
  DROP CONSTRAINT IF EXISTS fiscal_series_contingency_indicator_chk;
ALTER TABLE public.fiscal_series
  ADD CONSTRAINT fiscal_series_contingency_indicator_chk
  CHECK (
    series_contingency_indicator IS NULL
    OR series_contingency_indicator IN ('N','C')
  );

ALTER TABLE public.fiscal_series
  DROP CONSTRAINT IF EXISTS fiscal_series_year_chk;
ALTER TABLE public.fiscal_series
  ADD CONSTRAINT fiscal_series_year_chk
  CHECK (series_year IS NULL OR series_year BETWEEN 2000 AND 2200);

ALTER TABLE public.fiscal_series
  DROP CONSTRAINT IF EXISTS fiscal_series_authorized_range_chk;
ALTER TABLE public.fiscal_series
  ADD CONSTRAINT fiscal_series_authorized_range_chk
  CHECK (
    agt_status <> 'provisioned'
    OR (
      agt_series_code IS NOT NULL
      AND agt_submission_uuid IS NOT NULL
      AND series_year IS NOT NULL
      AND establishment_number IS NOT NULL
      AND series_contingency_indicator IS NOT NULL
      AND authorized_quantity IS NOT NULL
      AND first_document_no IS NOT NULL
      AND last_document_no IS NOT NULL
      AND agt_provisioned_at IS NOT NULL
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS ux_fiscal_series_empresa_agt_code
  ON public.fiscal_series (empresa_id, agt_series_code)
  WHERE agt_series_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_fiscal_series_agt_submission_uuid
  ON public.fiscal_series (agt_submission_uuid)
  WHERE agt_submission_uuid IS NOT NULL;


-- Durable request ledger for AGT series provisioning. This prevents a timeout
-- from silently causing a second submission with a new identity.
CREATE TABLE IF NOT EXISTS public.fiscal_series_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.fiscal_empresas(id) ON DELETE RESTRICT,
  requested_by uuid NOT NULL,
  idempotency_key text NOT NULL,
  submission_uuid uuid NOT NULL,
  document_type text NOT NULL,
  series_year integer NOT NULL,
  establishment_number text NOT NULL,
  contingency_indicator text NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  fiscal_serie_id uuid NULL REFERENCES public.fiscal_series(id) ON DELETE RESTRICT,
  error_payload jsonb NULL,
  response_payload jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fiscal_series_requests_status_chk
    CHECK (status IN ('processing','provisioned','rejected','uncertain')),
  CONSTRAINT fiscal_series_requests_contingency_chk
    CHECK (contingency_indicator IN ('N','C')),
  CONSTRAINT fiscal_series_requests_year_chk
    CHECK (series_year BETWEEN 2000 AND 2200),
  CONSTRAINT fiscal_series_requests_idempotency_uk
    UNIQUE (empresa_id, idempotency_key),
  CONSTRAINT fiscal_series_requests_submission_uk
    UNIQUE (submission_uuid)
);

ALTER TABLE public.fiscal_series_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fiscal_series_requests_select ON public.fiscal_series_requests;
CREATE POLICY fiscal_series_requests_select
ON public.fiscal_series_requests
FOR SELECT TO authenticated
USING (
  public.check_super_admin_role()
  OR public.user_has_role_in_empresa(
    empresa_id,
    ARRAY['owner','admin','operator']::text[]
  )
);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON TABLE public.fiscal_series_requests
  FROM anon, authenticated;
GRANT SELECT ON TABLE public.fiscal_series_requests TO authenticated;
GRANT ALL ON TABLE public.fiscal_series_requests TO service_role;

CREATE INDEX IF NOT EXISTS idx_fiscal_series_requests_empresa_status
  ON public.fiscal_series_requests (empresa_id, status, created_at DESC);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.fiscal_series FROM anon, authenticated;
DROP POLICY IF EXISTS fiscal_series_insert ON public.fiscal_series;
DROP POLICY IF EXISTS fiscal_series_update ON public.fiscal_series;
DROP POLICY IF EXISTS fiscal_series_delete ON public.fiscal_series;

CREATE OR REPLACE FUNCTION public.fiscal_guard_series_counter()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public'
AS $$
BEGIN
  IF NEW.ultimo_numero IS DISTINCT FROM OLD.ultimo_numero
     AND current_user <> 'postgres' THEN
    RAISE EXCEPTION 'IMMUTABILITY: contador fiscal só pode avançar pela RPC fiscal_reservar_numero_serie';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fiscal_series_counter_guard ON public.fiscal_series;
CREATE TRIGGER trg_fiscal_series_counter_guard
BEFORE UPDATE OF ultimo_numero ON public.fiscal_series
FOR EACH ROW EXECUTE FUNCTION public.fiscal_guard_series_counter();

-- Reservation remains atomic and additionally enforces the AGT-authorized range.
CREATE OR REPLACE FUNCTION public.fiscal_reservar_numero_serie(p_serie_id uuid)
RETURNS TABLE(numero bigint, numero_formatado text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $bill$
DECLARE
  v_uid uuid := public.safe_auth_uid();
  v_serie public.fiscal_series%ROWTYPE;
  v_last_authorized bigint;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH: utilizador não autenticado';
  END IF;

  SELECT *
    INTO v_serie
  FROM public.fiscal_series
  WHERE id = p_serie_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: série não encontrada';
  END IF;

  IF NOT public.user_has_role_in_empresa(
    v_serie.empresa_id,
    ARRAY['owner','admin','operator']
  ) THEN
    RAISE EXCEPTION 'AUTH: permissão negada para reservar número da série';
  END IF;

  IF NOT v_serie.ativa OR v_serie.descontinuada_em IS NOT NULL THEN
    RAISE EXCEPTION 'STATE: série inativa ou descontinuada';
  END IF;

  IF v_serie.agt_status = 'provisioned' THEN
    IF v_serie.last_document_no IS NULL OR v_serie.agt_series_code IS NULL THEN
      RAISE EXCEPTION 'STATE: série AGT provisionada sem intervalo autorizado';
    END IF;

    BEGIN
      v_last_authorized := v_serie.last_document_no::bigint;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'STATE: last_document_no AGT não é numérico';
    END;

    IF v_serie.ultimo_numero >= v_last_authorized THEN
      RAISE EXCEPTION 'STATE: intervalo autorizado pela AGT esgotado';
    END IF;
  ELSIF v_serie.agt_status <> 'legacy' THEN
    RAISE EXCEPTION 'STATE: série ainda não foi provisionada pela AGT';
  END IF;

  UPDATE public.fiscal_series
     SET ultimo_numero = ultimo_numero + 1,
         updated_at = now()
   WHERE id = p_serie_id
   RETURNING ultimo_numero INTO numero;

  numero_formatado := CASE
    WHEN v_serie.agt_status = 'provisioned'
      THEN upper(trim(v_serie.tipo_documento)) || ' ' || trim(v_serie.agt_series_code) || '/' || numero::text
    ELSE v_serie.prefixo || '-' || lpad(numero::text, 6, '0')
  END;

  RETURN NEXT;
END;
$bill$;

-- BILL-004: keep only the current 15-argument emission contract.
DROP FUNCTION IF EXISTS public.fiscal_emitir_documento(
  uuid, uuid, text, text, text, jsonb, date, text, jsonb,
  uuid, uuid, numeric, jsonb, text
);

DROP FUNCTION IF EXISTS public.fiscal_emitir_documento(
  uuid, uuid, text, text, text, jsonb, uuid, uuid, date, text,
  numeric, jsonb, jsonb, text
);

DROP FUNCTION IF EXISTS public.fiscal_emitir_documento(
  uuid, uuid, text, text, text, jsonb, uuid, uuid, date, text,
  numeric, jsonb, jsonb
);

REVOKE ALL ON FUNCTION public.fiscal_emitir_documento(
  uuid, uuid, text, text, text, jsonb, date, text, jsonb,
  uuid, uuid, numeric, jsonb, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fiscal_emitir_documento(
  uuid, uuid, text, text, text, jsonb, date, text, jsonb,
  uuid, uuid, numeric, jsonb, text, text
) TO authenticated, service_role;

COMMIT;
