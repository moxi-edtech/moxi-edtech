BEGIN;

CREATE OR REPLACE FUNCTION public.fiscal_guard_saft_document_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $bill$
DECLARE
  v_serie public.fiscal_series%ROWTYPE;
  v_expected text;
  v_tipo text := upper(btrim(coalesce(NEW.tipo_documento,'')));
BEGIN
  IF NOT NEW.saft_required OR COALESCE(OLD.saft_required,false) THEN
    RETURN NEW;
  END IF;

  IF v_tipo NOT IN (
    'FT','FR','GF','FG','AC','AR','ND','NC','AF','TV',
    'RP','RE','CS','LD','RA',
    'PP',
    'GR','GT','GA','GD'
  ) THEN
    RAISE EXCEPTION
      'STATE: tipo % não utiliza Hash/HashControl na cadeia SAF-T(AO)',
      v_tipo;
  END IF;

  SELECT *
    INTO v_serie
  FROM public.fiscal_series
  WHERE id=NEW.serie_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STATE: série fiscal do documento não encontrada';
  END IF;

  IF v_serie.agt_status IS DISTINCT FROM 'provisioned'
     OR nullif(btrim(coalesce(v_serie.agt_series_code,'')),'') IS NULL THEN
    RAISE EXCEPTION
      'STATE: assinatura SAF-T validada exige série provisionada pela AGT';
  END IF;

  v_expected :=
    v_tipo || ' ' ||
    btrim(v_serie.agt_series_code) || '/' ||
    NEW.numero::text;

  IF NEW.numero_formatado IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION
      'DATA: InvoiceNo SAF-T divergente; esperado %, recebido %',
      v_expected,
      NEW.numero_formatado;
  END IF;

  RETURN NEW;
END;
$bill$;

REVOKE EXECUTE ON FUNCTION public.fiscal_guard_saft_document_identity()
FROM PUBLIC, anon, authenticated, service_role;

COMMIT;