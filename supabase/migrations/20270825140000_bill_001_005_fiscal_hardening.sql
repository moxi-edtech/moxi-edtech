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
