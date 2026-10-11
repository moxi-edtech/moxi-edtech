BEGIN;

CREATE OR REPLACE FUNCTION public.fiscal_require_agt_series_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public'
AS $bill$
DECLARE
  v_serie public.fiscal_series%ROWTYPE;
BEGIN
  SELECT *
    INTO v_serie
  FROM public.fiscal_series
  WHERE id = NEW.serie_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: série fiscal não encontrada';
  END IF;

  IF v_serie.empresa_id IS DISTINCT FROM NEW.empresa_id
     OR v_serie.tipo_documento IS DISTINCT FROM NEW.tipo_documento THEN
    RAISE EXCEPTION 'DATA: série fiscal incompatível com o documento';
  END IF;

  IF v_serie.agt_status IS DISTINCT FROM 'provisioned'
     OR nullif(trim(coalesce(v_serie.agt_series_code, '')), '') IS NULL
     OR v_serie.agt_submission_uuid IS NULL
     OR v_serie.agt_provisioned_at IS NULL THEN
    RAISE EXCEPTION 'STATE: emissão fiscal exige série provisionada pela AGT';
  END IF;

  IF v_serie.series_year IS DISTINCT FROM extract(year from NEW.invoice_date)::integer THEN
    RAISE EXCEPTION 'STATE: ano da série AGT diverge da data do documento';
  END IF;

  IF v_serie.series_contingency_indicator NOT IN ('N','C') THEN
    RAISE EXCEPTION 'STATE: indicador de contingência da série AGT inválido';
  END IF;

  RETURN NEW;
END;
$bill$;

DROP TRIGGER IF EXISTS trg_fiscal_documentos_require_agt_series
ON public.fiscal_documentos;

CREATE TRIGGER trg_fiscal_documentos_require_agt_series
BEFORE INSERT ON public.fiscal_documentos
FOR EACH ROW EXECUTE FUNCTION public.fiscal_require_agt_series_on_insert();

COMMIT;
